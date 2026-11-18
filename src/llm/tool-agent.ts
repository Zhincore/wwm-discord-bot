import type { OpenRouter } from '@openrouter/sdk';
import type {
  InputsUnion,
  OutputFunctionCallItem,
  OutputItems,
  ResponsesRequest,
} from '@openrouter/sdk/models';
import * as z from 'zod';

type InputItem = Exclude<InputsUnion, string>[number];

export interface Tool<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  /** Arguments object; validates model input and is advertised as JSON Schema */
  schema: Schema;
  /** Result is sent back to the model; non-strings are JSON-encoded */
  execute(args: z.output<Schema>, signal?: AbortSignal): unknown;
}

/** Define a tool whose `execute` arguments are inferred from `schema`. */
export function defineTool<Schema extends z.ZodObject>(
  tool: Tool<Schema>,
): Tool {
  return tool as unknown as Tool;
}

export interface ToolAgentOptions {
  /** One model, or several in order of preference: later ones are tried when an earlier one fails */
  model: string | readonly string[];
  tools: readonly Tool[];
  /** Default system prompt */
  instructions?: string;
  /** Max model round-trips per run; the last one is sent without tools to force an answer */
  maxIterations?: number;
  /** Extra request fields, e.g. `reasoning`, `provider`, `parallelToolCalls` */
  request?: Omit<
    ResponsesRequest,
    'model' | 'input' | 'tools' | 'instructions' | 'stream'
  >;
}

/** One earlier message of a conversation */
export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolAgentRunOptions {
  /** System prompt for this run; replaces the agent's default */
  instructions?: string;
  /** Earlier turns of the conversation, oldest first; sent before `prompt` */
  history?: readonly Turn[];
  signal?: AbortSignal;
}

const DEFAULT_MAX_ITERATIONS = 10;
const FINAL_TURN_NOTICE =
  'Tools are no longer available. Do not request or write any tool call. ' +
  'Answer now in plain text using only the results above; if they are insufficient, say what is missing.';

/** Runs a model with client-side tools until it produces a final text answer. */
export class ToolAgent {
  readonly #tools: Map<string, Tool>;
  readonly #definitions: NonNullable<ResponsesRequest['tools']>;

  constructor(
    private readonly llm: OpenRouter,
    private readonly options: ToolAgentOptions,
  ) {
    this.#tools = new Map(options.tools.map((tool) => [tool.name, tool]));
    this.#definitions = options.tools.map((tool) => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: z.toJSONSchema(tool.schema, { io: 'input' }),
    }));
  }

  /** Answer `prompt`, executing tool calls in between; returns only the final text. */
  async run(
    prompt: string,
    {
      instructions = this.options.instructions,
      history = [],
      signal,
    }: ToolAgentRunOptions = {},
  ): Promise<string> {
    const { request } = this.options;
    const models = [this.options.model].flat();
    const maxIterations = this.options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const input: InputItem[] = [
      ...history.map(({ role, content }) => ({ role, content })),
      { role: 'user', content: prompt },
    ];

    for (let i = 0; i < maxIterations; i++) {
      const last = i === maxIterations - 1;
      if (last && i > 0)
        input.push({ role: 'user', content: FINAL_TURN_NOTICE });
      const result = await this.llm.responses.send(
        {
          responsesRequest: {
            ...request,
            provider: { requireParameters: true, ...request?.provider },
            ...(models.length > 1 ? { models } : { model: models[0] }),
            instructions,
            tools: last ? undefined : this.#definitions,
            input,
            stream: false,
          },
        },
        { signal },
      );
      if (result.status !== 'completed') {
        throw new Error(
          `Model response ${result.status}: ${result.error?.message ?? result.incompleteDetails?.reason ?? 'no details'}`,
        );
      }

      // Reasoning and call items must be sent back in order for the model to continue
      input.push(...(result.output as InputItem[]));

      const calls = result.output.filter(isFunctionCall);
      if (calls.length === 0) return finalText(result.output);
      if (last) break;

      const outputs = await Promise.all(
        calls.map((call) => this.#execute(call, signal)),
      );
      for (const [index, call] of calls.entries()) {
        input.push({
          type: 'function_call_output',
          callId: call.callId,
          output: outputs[index]!,
        });
      }
    }
    throw new Error(`No final answer after ${maxIterations} iterations`);
  }

  /** Run one tool call; invalid arguments and failures are reported to the model instead of thrown. */
  async #execute(
    call: OutputFunctionCallItem,
    signal?: AbortSignal,
  ): Promise<string> {
    try {
      const tool = this.#tools.get(call.name);
      if (!tool) throw new Error(`Unknown tool "${call.name}"`);
      const args = tool.schema.safeParse(JSON.parse(call.arguments || '{}'));
      if (!args.success) throw new Error(z.prettifyError(args.error));
      const result = await tool.execute(args.data, signal);
      return typeof result === 'string'
        ? result
        : JSON.stringify(result ?? null);
    } catch (error) {
      signal?.throwIfAborted();
      return JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function isFunctionCall(item: OutputItems): item is OutputFunctionCallItem {
  return item.type === 'function_call';
}

/** Concatenated text of the last assistant message */
function finalText(output: OutputItems[]): string {
  const message = output.findLast((item) => item.type === 'message');
  if (!message || !('content' in message) || !Array.isArray(message.content))
    return '';
  return message.content
    .map((part) =>
      part.type === 'output_text' && 'text' in part ? String(part.text) : '',
    )
    .join('');
}
