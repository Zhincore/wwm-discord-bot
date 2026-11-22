import type { OpenRouter } from '@openrouter/sdk';
import type {
  InputsUnion,
  OutputFunctionCallItem,
  OutputItems,
  ResponsesRequest,
} from '@openrouter/sdk/models';
import * as z from 'zod';

import { FINAL_TURN_NOTICE } from './instructions';

// Order matters!
export enum ToolLevel {
  /** Anyone can use this tool */
  BASIC = 'BASIC',
  /** Only authorized personel */
  ADVANCED = 'ADVANCED',
}

type InputItem = Exclude<InputsUnion, string>[number];

export interface Tool<Schema extends z.ZodObject = z.ZodObject> {
  name: string;
  description: string;
  toolLevel: ToolLevel;
  /** Arguments object; validates model input and is advertised as JSON Schema */
  schema: Schema;
  prepareSchema?: (schema: Schema, toolLevel: ToolLevel) => z.ZodObject;
  /** Result is sent back to the model; non-strings are JSON-encoded */
  execute(
    args: z.output<Schema>,
    toolLevel: ToolLevel,
    signal?: AbortSignal,
  ): unknown;
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
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ToolAgentRunOptions {
  /** System prompt for this run; replaces the agent's default */
  instructions?: string;
  /** Earlier turns of the conversation, oldest first; sent before `prompt` */
  history?: readonly Turn[];
  signal?: AbortSignal;
  toolLevel?: ToolLevel;
}

const DEFAULT_MAX_ITERATIONS = 10;

/** Runs a model with client-side tools until it produces a final text answer. */
export class ToolAgent {
  readonly #tools = new Map<ToolLevel, Map<string, Tool>>();
  readonly #definitions = new Map<
    ToolLevel,
    NonNullable<ResponsesRequest['tools']>
  >();

  constructor(
    private readonly llm: OpenRouter,
    private readonly options: ToolAgentOptions,
    tools: readonly Tool[],
  ) {
    const toEntry = (tool: Tool) => [tool.name, tool] as const;
    const toDefinition = (tool: Tool, level: ToolLevel) =>
      ({
        type: 'function',
        name: tool.name,
        description: tool.description,
        parameters: z.toJSONSchema(
          tool.prepareSchema?.(tool.schema, level) ?? tool.schema,
          { io: 'input' },
        ),
      }) as const;

    const levels = Object.values(ToolLevel);
    for (const level of levels) {
      const filtered = tools.filter(
        (t) => levels.indexOf(t.toolLevel) <= levels.indexOf(level),
      );
      this.#tools.set(level, new Map(filtered.map(toEntry)));
      this.#definitions.set(
        level,
        filtered.map((t) => toDefinition(t, level)),
      );
    }
  }

  /** Answer `prompt`, executing tool calls in between; returns only the final text. */
  async run(
    prompt: string,
    {
      instructions = this.options.instructions,
      history = [],
      signal,
      toolLevel = ToolLevel.BASIC,
    }: ToolAgentRunOptions = {},
  ): Promise<string> {
    const { request } = this.options;
    const models = [this.options.model].flat();
    const maxIterations = this.options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const input: InputItem[] = [...history, { role: 'user', content: prompt }];
    const tools = this.#definitions.get(toolLevel)!;

    for (let i = 0; i < maxIterations; i++) {
      const last = i === maxIterations - 1;
      if (last && i > 0)
        input.push({ role: 'system', content: FINAL_TURN_NOTICE });
      const result = await this.llm.responses.send(
        {
          responsesRequest: {
            ...request,
            provider: { requireParameters: true, ...request?.provider },
            ...(models.length > 1 ? { models } : { model: models[0] }),
            instructions,
            tools: last ? undefined : tools,
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
        calls.map((call) => this.#execute(call, toolLevel, signal)),
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
    toolLevel = ToolLevel.BASIC,
    signal?: AbortSignal,
  ): Promise<string> {
    const tools = this.#tools.get(toolLevel)!;

    try {
      const tool = tools.get(call.name);
      if (!tool) throw new Error(`Unknown tool "${call.name}"`);
      const args = tool.schema.safeParse(JSON.parse(call.arguments || '{}'));
      if (!args.success) throw new Error(z.prettifyError(args.error));
      const result = await tool.execute(args.data, toolLevel, signal);
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
