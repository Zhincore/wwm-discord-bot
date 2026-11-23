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

const note = (name: string) => ({
  role: 'system',
  content: `The next message is from Discord user "${name}". They have no linked game character.`,
});

describe('formatUserTurn', () => {
  it('puts a speaker note before the plain message', () => {
    expect(formatUserTurn({ name: 'Ann' }, 'hi')).toEqual([
      note('Ann'),
      { role: 'user', content: 'hi' },
    ]);
  });

  it('names the linked character in the note', () => {
    const [speaker] = formatUserTurn(
      { name: 'Ann', character: { name: 'Mossfern', uid: '42' } },
      'hi',
    );
    expect(speaker.content).toBe(
      'The next message is from Discord user "Ann". Their game character is "Mossfern" (UID 42).',
    );
  });
});

describe('trimHistory', () => {
  it('keeps the newest six messages with their notes and bounds their length', () => {
    const turns = Array.from({ length: 5 }, (_, i) => [
      { role: 'system' as const, content: 'note' },
      { role: 'user' as const, content: `q${i}` },
      {
        role: 'assistant' as const,
        content: i === 4 ? 'x'.repeat(2000) : `a${i}`,
      },
    ]).flat();
    const trimmed = trimHistory(turns);
    expect(trimmed.map((t) => t.content.slice(0, 2))).toEqual([
      'no',
      'q2',
      'a2',
      'no',
      'q3',
      'a3',
      'no',
      'q4',
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
      { role: 'system' as const, content: 'note' },
      { role: 'user' as const, content: 'q1' },
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
      note('ann'),
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      note('bob'),
      { role: 'user', content: 'q2' },
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
    expect(
      history.filter((t) => t.role !== 'system').map((t) => t.content),
    ).toEqual(['t4', 't5', 't6', 't7', 't8', 't9']);
    expect(history.filter((t) => t.role === 'system')).toHaveLength(3);
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
