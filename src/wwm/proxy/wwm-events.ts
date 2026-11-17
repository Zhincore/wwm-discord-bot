import { setTimeout as sleep } from 'node:timers/promises';

import { events, EventStreamError } from '#common/events.js';

import type { BridgeEvent } from './wwm-api';

export type WwmEventName = BridgeEvent['ev'];
export type WwmEventOf<E extends WwmEventName> = Extract<
  BridgeEvent,
  { ev: E }
>;
export type WwmEventListener<E extends WwmEventName> = (
  event: WwmEventOf<E>,
) => unknown;
/** Server-side filter: event field -> accepted values */
export type WwmEventFilter = Record<string, readonly string[]>;

type AnyListener = WwmEventListener<WwmEventName>;
type EventLogger = Pick<Console, 'debug' | 'warn' | 'error'>;

const BASE_DELAY = 1_000;
const MAX_DELAY = 30_000;

/** Keeps the `GET /events` stream open and dispatches events to typed listeners. */
export class WwmEvents {
  readonly #query = new URLSearchParams();
  readonly #listeners = new Map<WwmEventName, Set<AnyListener>>();
  #abort?: AbortController;
  #running?: Promise<void>;
  #lastId?: string;

  constructor(
    private readonly baseUrl: string,
    private readonly token?: string,
    private readonly logger: EventLogger = console,
    filter: WwmEventFilter = {},
  ) {
    if (this.#abort) return;
    this.#query = new URLSearchParams();
    for (const [field, values] of Object.entries(filter)) {
      this.#query.set(field, values.join(','));
    }
  }

  /** Open the stream; no-op while already running. */
  start() {
    this.#abort = new AbortController();
    this.#running = this.#run(
      `${this.baseUrl}/events?${this.#query}`,
      this.#abort.signal,
    );
  }

  /** Close the stream and wait for the reader to finish. */
  async stop() {
    this.#abort?.abort();
    this.#abort = undefined;
    await this.#running;
  }

  /** Subscribe to one event type; returns the unsubscribe function. */
  on<E extends WwmEventName>(ev: E, listener: WwmEventListener<E>): () => void {
    let listeners = this.#listeners.get(ev);
    if (!listeners) {
      listeners = new Set();
      this.#listeners.set(ev, listeners);
    }
    listeners.add(listener as unknown as AnyListener);
    return () => listeners.delete(listener as unknown as AnyListener);
  }

  /** Consume the stream, reconnecting with backoff and resuming after the last seen event. */
  async #run(url: string, signal: AbortSignal) {
    let attempts = 0;

    while (!signal.aborted) {
      try {
        const stream = events<BridgeEvent>(url, {
          token: this.token,
          lastId: this.#lastId,
          signal,
          onInvalid: (data) =>
            this.logger.warn(`Skipped malformed event: ${data.slice(0, 200)}`),
        });
        for await (const event of stream) {
          attempts = 0;
          this.#lastId = String(event.seq);
          this.#dispatch(event);
        }
        this.logger.debug('Event stream ended');
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof EventStreamError && !error.retriable) {
          this.logger.error(`${error.message}, game events stopped`);
          return;
        }
        this.logger.warn(`Event stream lost: ${String(error)}`);
      }

      // Exponential backoff with equal jitter: delay in [exp/2, exp]
      const exp = Math.min(MAX_DELAY, BASE_DELAY * 2 ** attempts++);
      await sleep(exp / 2 + (Math.random() * exp) / 2, undefined, {
        signal,
      }).catch(() => undefined);
    }
  }

  /** Listener failures, sync or async, are logged and never break the stream. */
  #dispatch(event: BridgeEvent) {
    for (const listener of this.#listeners.get(event.ev) ?? []) {
      Promise.resolve()
        .then(() => listener(event))
        .catch((error) =>
          this.logger.error(`Listener for "${event.ev}" failed`, error),
        );
    }
  }
}
