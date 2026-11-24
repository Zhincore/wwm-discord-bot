import type { OpenRouter } from '@openrouter/sdk';
import * as z from 'zod';

import { defineTool, ToolAgent } from './tool-agent';

const message = (text: string) => ({
  type: 'message',
  role: 'assistant',
  id: 'm',
  content: [{ type: 'output_text', text }],
});

/** Client stub replaying canned outputs and recording each request. */
function stubClient(...outputs: object[][]) {
  const requests: any[] = [];
  const send = vi.fn(async ({ responsesRequest }: any) => {
    requests.push(structuredClone(responsesRequest));
    return {
      status: 'completed',
      output: outputs[requests.length - 1] ?? [message('done')],
    };
  });
  return { llm: { responses: { send } } as unknown as OpenRouter, requests };
}

const add = defineTool({
  toolLevel: 'BASIC',
  name: 'add',
  description: 'add',
  schema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => ({ sum: a + b }),
});

describe('ToolAgent', () => {
  it('sends history before the prompt and returns only the final text', async () => {
    const { llm, requests } = stubClient([message('second answer')]);
    const agent = new ToolAgent(llm, { model: 'm' }, [add]);
    const history = [
      { role: 'system' as const, content: 'speaker: Ann' },
      { role: 'user' as const, content: 'first' },
      { role: 'assistant' as const, content: 'first answer' },
      { role: 'system' as const, content: 'speaker: Bob' },
    ];
    const answer = await agent.run('and now?', { history });
    expect(answer).toBe('second answer');
    expect(requests[0].input).toEqual([
      ...history,
      { role: 'user', content: 'and now?' },
    ]);
  });

  it('runs tool calls, reports invalid arguments to the model, then answers', async () => {
    const { llm, requests } = stubClient(
      [
        {
          type: 'function_call',
          callId: 'c1',
          name: 'add',
          arguments: '{"a":"x","b":2}',
        },
        {
          type: 'function_call',
          callId: 'c2',
          name: 'add',
          arguments: '{"a":1,"b":2}',
        },
      ],
      [message('three')],
    );
    const agent = new ToolAgent(llm, { model: 'm' }, [add]);
    expect(await agent.run('1+2?')).toBe('three');
    const outputs = requests[1].input.filter(
      (i: any) => i.type === 'function_call_output',
    );
    expect(outputs[0].output).toContain('error');
    expect(outputs[1]).toMatchObject({ callId: 'c2', output: '{"sum":3}' });
  });

  it('sends the last round without tools plus a notice, and throws if still no answer', async () => {
    const call = {
      type: 'function_call',
      callId: 'c',
      name: 'add',
      arguments: '{"a":1,"b":2}',
    };
    const { llm, requests } = stubClient([call], [call]);
    const agent = new ToolAgent(llm, { model: 'm', maxIterations: 2 }, [add]);
    await expect(agent.run('loop')).rejects.toThrow(
      'No final answer after 2 iterations',
    );
    expect(requests[0].tools).toHaveLength(1);
    expect(requests[1].tools).toBeUndefined();
    expect(requests[1].input.at(-1).content).toMatch(
      /Tools are no longer available/,
    );
  });
});
