import { CacheMap } from '#common/cache-map.ts';

import type { Turn } from './tool-agent';

const MAX_TURNS = 6;
const MAX_TURN_LENGTH = 1500;
const CACHE_TTL = 60 * 60_000;
const CACHE_SIZE = 500;

/** Who asked; `character` is their linked game character when known. */
export interface Asker {
  id: string;
  name: string;
  character?: { name: string; uid: string };
}

/** The part of a Discord message the reply-chain walk needs */
export interface ChainMessage {
  id: string;
  author: { id: string; displayName: string };
  reference: { messageId?: string } | null;
  fetchReference(): Promise<ChainMessage>;
}

/** System note naming who wrote the user message that follows it. */
export function speakerNote(asker: Omit<Asker, 'id'>): Turn {
  const character = asker.character
    ? `Their game character is "${asker.character.name}" (UID ${asker.character.uid}).`
    : 'They have no linked game character.';
  return {
    role: 'system',
    content: `The next message is from Discord user "${asker.name}". ${character}`,
  };
}

/** A user message as the model sees it: the speaker note, then the plain text. */
export function formatUserTurn(
  asker: Omit<Asker, 'id'>,
  text: string,
): [note: Turn, message: Turn] {
  return [speakerNote(asker), { role: 'user', content: text }];
}

/** Keep the newest messages with their speaker notes and bound each one's length. */
export function trimHistory(turns: readonly Turn[]): Turn[] {
  let start = turns.length;
  let messages = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i]!.role !== 'system' && ++messages > MAX_TURNS) break;
    start = i;
  }
  return turns.slice(start).map(({ role, content }) => ({
    role,
    content:
      content.length > MAX_TURN_LENGTH
        ? `${content.slice(0, MAX_TURN_LENGTH)}…`
        : content,
  }));
}

/** Remembers conversations by the bot's answer message; rebuilds forgotten ones from the reply chain. */
export class Conversations<Message extends ChainMessage = ChainMessage> {
  readonly #transcripts = new CacheMap<string, Turn[]>({
    ttl: CACHE_TTL,
    maxSize: CACHE_SIZE,
  });

  constructor(
    private readonly botId: string,
    /** Text of a message with the bot's mention removed; empty when unreadable */
    private readonly readText: (message: Message) => string,
  ) {}

  /** Store the conversation so far under the answer that ends it. */
  remember(answerId: string, turns: readonly Turn[]) {
    this.#transcripts.set(answerId, trimHistory(turns));
  }

  /** Earlier turns of the conversation `message` replies to; empty when it starts a new one. */
  async historyFor(message: Message): Promise<Turn[]> {
    const repliedId = message.reference?.messageId;
    if (!repliedId) return [];
    const cached = this.#transcripts.get(repliedId);
    if (cached) return cached;

    const answer = await this.#referenced(message);
    // Only the bot's own replies are answers; its other posts start a fresh conversation
    if (!answer || answer.author.id !== this.botId || !answer.reference) {
      return [];
    }
    return this.#walk(answer);
  }

  /** Follow the reply chain upwards from `newest`, oldest turn first. */
  async #walk(newest: Message): Promise<Turn[]> {
    const turns: Turn[] = [];
    let messages = 0;
    let current: Message | undefined = newest;
    while (current) {
      const text = this.readText(current);
      if (!text) break;
      if (current.author.id === this.botId) {
        turns.unshift({ role: 'assistant', content: text });
      } else {
        turns.unshift(
          ...formatUserTurn({ name: current.author.displayName }, text),
        );
      }
      if (++messages >= MAX_TURNS) break;
      current = await this.#referenced(current);
    }
    return trimHistory(turns);
  }

  async #referenced(message: Message): Promise<Message | undefined> {
    if (!message.reference?.messageId) return;
    try {
      return (await message.fetchReference()) as Message;
    } catch {
      return;
    }
  }
}
