export interface EventStreamOptions {
  token?: string;
  /** Last seen event id; the server replays what came after it */
  lastId?: string;
  signal?: AbortSignal;
  /** Max silence before the stream is considered dead, ms */
  idleTimeout?: number;
  /** Called with the raw payload of a message that is not valid JSON */
  onInvalid?: (data: string, error: unknown) => void;
}

export class EventStreamError extends Error {
  constructor(readonly status: number) {
    super(`event stream failed: HTTP ${status}`);
  }

  /** Client errors other than timeout / rate limit will not go away on retry */
  get retriable(): boolean {
    return this.status >= 500 || this.status === 408 || this.status === 429;
  }
}

const DEFAULT_IDLE_TIMEOUT = 30_000;

/** Extract the `data` payload of one SSE message; empty for comments and keep-alives. */
function parseData(message: string): string {
  const data: string[] = [];
  for (const line of message.split('\n')) {
    const colon = line.indexOf(':');
    if (colon <= 0 || line.slice(0, colon) !== 'data') continue;
    const value = line.slice(colon + 1);
    data.push(value.startsWith(' ') ? value.slice(1) : value);
  }
  return data.join('\n');
}

/** Yield JSON payloads of an SSE stream until it ends, goes silent or `signal` aborts. */
export async function* events<T>(
  url: string,
  {
    token,
    lastId,
    signal,
    idleTimeout = DEFAULT_IDLE_TIMEOUT,
    onInvalid,
  }: EventStreamOptions = {},
): AsyncGenerator<T> {
  const headers: Record<string, string> = { accept: 'text/event-stream' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  if (lastId) headers['last-event-id'] = lastId;

  const idle = new AbortController();
  const timeout = () =>
    idle.abort(new Error(`event stream idle for ${idleTimeout} ms`));
  let timer = setTimeout(timeout, idleTimeout);

  try {
    const res = await fetch(url, {
      headers,
      signal: signal ? AbortSignal.any([signal, idle.signal]) : idle.signal,
    });
    if (!res.ok || !res.body) throw new EventStreamError(res.status);
    const type = res.headers.get('content-type') ?? '';
    if (!type.startsWith('text/event-stream'))
      throw new Error(`event stream failed: unexpected content-type "${type}"`);

    const decoder = new TextDecoder();
    let raw = '';
    let buffer = '';
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      clearTimeout(timer);
      timer = setTimeout(timeout, idleTimeout);

      // A trailing CR may be half of a CRLF split across chunks; keep it for the next round
      raw += decoder.decode(chunk, { stream: true });
      const cut = raw.endsWith('\r') ? raw.length - 1 : raw.length;
      buffer += raw.slice(0, cut).replace(/\r\n?/g, '\n');
      raw = raw.slice(cut);

      let end: number;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        const data = parseData(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
        if (!data) continue;
        let event: T;
        try {
          event = JSON.parse(data) as T;
        } catch (error) {
          onInvalid?.(data, error);
          continue;
        }
        yield event;
      }
    }
  } finally {
    clearTimeout(timer);
    idle.abort();
  }
}
