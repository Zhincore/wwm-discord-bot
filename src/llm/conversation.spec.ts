import {
  Conversations,
  formatUserTurn,
  trimHistory,
  type ChainMessage,
} from './conversation';

const BOT = 'bot';

interface FakeMessage extends ChainMessage {
  text: string;
}

/** Build a reply chain, oldest first; each message replies to the previous one. */
function chain(...specs: [author: string, text: string][]) {
  const fetched: string[] = [];
  let previous: FakeMessage | undefined;
  const messages = specs.map(([author, text], index) => {
    const parent = previous;
    const message: FakeMessage = {
      id: `m${index}`,
      text,
      author: { id: author, displayName: author === BOT ? 'Chirpy' : author },
      reference: parent ? { messageId: parent.id } : null,
      fetchReference: async () => {
        if (!parent) throw new Error('no reference');
        fetched.push(parent.id);
        return parent;
      },
    };
    previous = message;
    return message;
  });
  return { messages, fetched, last: messages.at(-1)! };
}

const conversations = () =>
  new Conversations<FakeMessage>(BOT, (message) => message.text);

describe('formatUserTurn', () => {
  it('labels the speaker, with the linked character when known', () => {
    expect(formatUserTurn({ name: 'Ann' }, 'hi')).toEqual({
      role: 'user',
      content: '[Ann] hi',
    });
    expect(
      formatUserTurn(
        { name: 'Ann', character: { name: 'Mossfern', uid: '42' } },
        'hi',
      ).content,
    ).toBe('[Ann | character: Mossfern, UID 42] hi');
  });
});

describe('trimHistory', () => {
  it('keeps the newest six turns and bounds their length', () => {
    const turns = Array.from({ length: 9 }, (_, i) => ({
      role: 'user' as const,
      content: i === 8 ? 'x'.repeat(2000) : `t${i}`,
    }));
    const trimmed = trimHistory(turns);
    expect(trimmed.map((t) => t.content.slice(0, 2))).toEqual([
      't3',
      't4',
      't5',
      't6',
      't7',
      'xx',
    ]);
    expect(trimmed.at(-1)!.content).toHaveLength(1501);
  });
});

describe('Conversations', () => {
  it('has no history for a message that is not a reply', async () => {
    const { last } = chain(['ann', 'who is online?']);
    expect(await conversations().historyFor(last)).toEqual([]);
  });

  it('returns the remembered transcript without touching Discord', async () => {
    const { last, fetched } = chain(['ann', 'q1'], [BOT, 'a1'], ['ann', 'q2']);
    const store = conversations();
    const turns = [
      {
        role: 'user' as const,
        content: '[Ann | character: Mossfern, UID 42] q1',
      },
      { role: 'assistant' as const, content: 'a1' },
    ];
    store.remember('m1', turns);
    expect(await store.historyFor(last)).toEqual(turns);
    expect(fetched).toEqual([]);
  });

  it('rebuilds a forgotten conversation from the reply chain', async () => {
    const { last } = chain(
      ['ann', 'q1'],
      [BOT, 'a1'],
      ['bob', 'q2'],
      [BOT, 'a2'],
      ['ann', 'q3'],
    );
    expect(await conversations().historyFor(last)).toEqual([
      { role: 'user', content: '[ann] q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: '[bob] q2' },
      { role: 'assistant', content: 'a2' },
    ]);
  });

  it('stops walking at the turn limit and at unreadable messages', async () => {
    const long = chain(
      ...Array.from({ length: 10 }, (_, i): [string, string] => [
        i % 2 ? BOT : 'ann',
        `t${i}`,
      ]),
      ['ann', 'next'],
    );
    const history = await conversations().historyFor(long.last);
    expect(history.map((t) => t.content)).toEqual([
      '[ann] t4',
      't5',
      '[ann] t6',
      't7',
      '[ann] t8',
      't9',
    ]);
    expect(long.fetched).toHaveLength(6);

    const withheld = chain(
      ['ann', 'q1'],
      [BOT, 'a1'],
      ['ann', ''],
      [BOT, 'a2'],
      ['ann', 'q3'],
    );
    expect(await conversations().historyFor(withheld.last)).toEqual([
      { role: 'assistant', content: 'a2' },
    ]);
  });

  it('starts fresh when replying to a bot post that is not an answer, or to a user', async () => {
    const announcement = chain(
      [BOT, 'New codes!'],
      ['ann', 'thanks, who is online?'],
    );
    expect(await conversations().historyFor(announcement.last)).toEqual([]);
    const toUser = chain(['bob', 'hello'], ['ann', 'who is online?']);
    expect(await conversations().historyFor(toUser.last)).toEqual([]);
  });

  it('starts fresh when the replied-to message cannot be fetched', async () => {
    const { last } = chain(['ann', 'q1'], [BOT, 'a1'], ['ann', 'q2']);
    last.fetchReference = async () => {
      throw new Error('Unknown Message');
    };
    expect(await conversations().historyFor(last)).toEqual([]);
  });
});
