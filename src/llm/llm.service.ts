import { Inject, Injectable, Optional } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';
import type { Snowflake } from 'discord.js';
import { eq, sql } from 'drizzle-orm';

import { DatabaseService } from '#common/database/database.service.ts';
import { GUILD_NAME, LLM_CONTEXT, LLM_MODELS } from '#consts.ts';
import { WwmService } from '#wwm/wwm.service.ts';

import { formatUserTurn, type Asker } from './conversation';
import { getInstructions } from './instructions';
import { llmRoles } from './llm-settings.schema';
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

  #getWhitelist;
  #addWhitelist;
  #removeWhitelist;

  constructor(
    wwm: WwmService,
    db: DatabaseService,
    @Optional()
    @Inject(ASKER_RESOLVER)
    private readonly askerResolver?: AskerResolver,
  ) {
    this.#agent = new ToolAgent(this.#llm, {
      model: LLM_MODELS,
      maxIterations: 5,
      request: { toolChoice: 'auto', store: false, temperature: 0.5 },
      tools: createWwmTools(wwm),
    });

    const guildId = sql.placeholder('guildId');
    const roleId = sql.placeholder('roleId');

    this.#getWhitelist = db
      .select()
      .from(llmRoles)
      .where(eq(llmRoles.guildId, guildId));
    this.#addWhitelist = db
      .insert(llmRoles)
      .values({ guildId, roleId })
      .onConflictDoUpdate({ target: llmRoles.guildId, set: { roleId } });
    this.#removeWhitelist = db
      .delete(llmRoles)
      .where(eq(llmRoles.guildId, guildId));
  }

  enable(guildId: Snowflake, roleId?: Snowflake) {
    return !!this.#addWhitelist.run({ guildId, roleId }).lastInsertRowid;
  }
  disable(guildId: Snowflake) {
    this.#removeWhitelist.run({ guildId });
  }

  isEnabled(guildId: Snowflake) {
    const result = this.#getWhitelist.get({ guildId });
    if (!result) return false;
    if (result.roleId) return result.roleId as Snowflake;
    return true;
  }

  /** Answer a question; resolves with the answer and the conversation including it. */
  async ask({ text, asker, history = [], signal }: Question) {
    if (this.#busy.has(asker.id)) throw new BusyError();
    this.#busy.add(asker.id);
    try {
      const character = await this.askerResolver
        ?.resolve(asker.id)
        .catch(() => undefined);
      const [note, turn] = formatUserTurn(
        { name: asker.name, character },
        text,
      );
      const timeout = AbortSignal.timeout(TIMEOUT);

      const answer = await this.#agent.run(turn.content, {
        instructions: getInstructions(GUILD_NAME, LLM_CONTEXT),
        history: [...history, note],
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (answer.trim().toUpperCase() === 'SKIP') return;

      const turns: Turn[] = [
        ...history,
        note,
        turn,
        { role: 'assistant', content: answer },
      ];
      return { answer, turns };
    } finally {
      this.#busy.delete(asker.id);
    }
  }
}
