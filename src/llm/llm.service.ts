import { Inject, Injectable, Optional } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';

import { GUILD_NAME, LLM_CONTEXT, LLM_MODEL } from '#consts.ts';
import { WwmService } from '#wwm/wwm.service.ts';

import { formatUserTurn, type Asker } from './conversation';
import { getInstructions } from './instructions';
import { ToolAgent, type Turn } from './tool-agent';
import { createWwmTools } from './wwm-tools';

const TIMEOUT = 60_000;

/** Injection token of the optional `AskerResolver` */
export const ASKER_RESOLVER = Symbol('ASKER_RESOLVER');

/** Finds the game character linked to a Discord user. */
export interface AskerResolver {
  resolve(userId: string): Promise<Asker['character']>;
}

/** Thrown when the asker already has a question running. */
export class BusyError extends Error {}

export interface Question {
  text: string;
  asker: Pick<Asker, 'id' | 'name'>;
  /** Earlier turns of the conversation, oldest first */
  history?: readonly Turn[];
  signal?: AbortSignal;
}

@Injectable()
export class LLMService {
  readonly #llm = new OpenRouter({
    apiKey: process.env['OPENROUTER_API_KEY'] ?? '',
  });
  readonly #agent: ToolAgent;
  readonly #busy = new Set<string>();

  constructor(
    wwm: WwmService,
    @Optional()
    @Inject(ASKER_RESOLVER)
    private readonly askerResolver?: AskerResolver,
  ) {
    this.#agent = new ToolAgent(this.#llm, {
      model: LLM_MODEL,
      maxIterations: 4,
      request: { toolChoice: 'auto', store: false, maxOutputTokens: 1024 },
      tools: createWwmTools(wwm),
    });
  }

  /** Answer a question; resolves with the answer and the conversation including it. */
  async ask({ text, asker, history = [], signal }: Question) {
    if (this.#busy.has(asker.id)) throw new BusyError();
    this.#busy.add(asker.id);
    try {
      const character = await this.askerResolver
        ?.resolve(asker.id)
        .catch(() => undefined);
      const turn = formatUserTurn({ name: asker.name, character }, text);
      const timeout = AbortSignal.timeout(TIMEOUT);

      const answer = await this.#agent.run(turn.content, {
        instructions: getInstructions(GUILD_NAME, LLM_CONTEXT),
        history,
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      const turns: Turn[] = [
        ...history,
        turn,
        { role: 'assistant', content: answer },
      ];
      return { answer, turns };
    } finally {
      this.#busy.delete(asker.id);
    }
  }
}
