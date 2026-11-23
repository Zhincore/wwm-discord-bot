import { Inject, Injectable, Optional } from '@nestjs/common';
import { OpenRouter } from '@openrouter/sdk';
import type { Snowflake } from 'discord.js';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import * as z from 'zod';

import { DatabaseService } from '#common/database/database.service.ts';
import { LLM_MODELS } from '#consts.ts';
import { WwmService } from '#wwm/wwm.service.ts';

import { getInstructions } from './instructions';
import { llmRoles } from './llm-settings.schema';
import { formatUserTurn, type Asker } from './utils/conversation';
import {
  defineTool,
  ToolAgent,
  ToolLevel,
  type Turn,
} from './utils/tool-agent';
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
  toolLevel?: ToolLevel;
  signal?: AbortSignal;
}

const STATIC_TOOLS = [
  defineTool({
    name: 'format_number',
    description:
      'Formats number for better readability (e.g. 10 000), use this when writing long numbers.',
    toolLevel: 'BASIC',
    schema: z.object({
      number: z.number().nonoptional().describe('The number to format'),
      locale: z
        .string()
        .optional()
        .describe('Optional user locale (cs, en_US, ...)'),
    }),
    execute: ({ number, locale }) => {
      try {
        return number.toLocaleString(locale);
      } catch {
        return number.toLocaleString();
      }
    },
  }),
];

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
    this.#agent = new ToolAgent(
      this.#llm,
      {
        model: LLM_MODELS,
        maxIterations: 5,
        request: { toolChoice: 'auto', store: false, temperature: 0.5 },
      },
      // Tools
      [...createWwmTools(wwm), ...STATIC_TOOLS],
    );

    const guildId = sql.placeholder('guildId');
    const roleId = sql.placeholder('roleId');
    const level = sql.placeholder('level');

    this.#getWhitelist = db
      .select()
      .from(llmRoles)
      .where(eq(llmRoles.guildId, guildId));
    this.#addWhitelist = db
      .insert(llmRoles)
      .values({ guildId, roleId, level })
      .onConflictDoUpdate({
        target: [llmRoles.guildId, llmRoles.level],
        set: { roleId },
      });
    this.#removeWhitelist = db
      .delete(llmRoles)
      .where(
        and(
          eq(llmRoles.guildId, guildId),
          or(isNull(level), eq(llmRoles.level, level)),
        ),
      );
  }

  enable(guildId: Snowflake, level: ToolLevel, roleId: Snowflake) {
    return !!this.#addWhitelist.run({ guildId, level, roleId }).lastInsertRowid;
  }
  disable(guildId: Snowflake, level?: ToolLevel) {
    return !!this.#removeWhitelist.run({ guildId, level }).changes;
  }

  getSettings(guildId: Snowflake): Record<ToolLevel, Snowflake> | undefined {
    const result = this.#getWhitelist.all({ guildId });
    if (!result.length) return;
    return Object.fromEntries(result.map((r) => [r.level, r.roleId]));
  }

  /** Answer a question; resolves with the answer and the conversation including it. */
  async ask({ text, asker, toolLevel, history = [], signal }: Question) {
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
        instructions: getInstructions(),
        history: [...history, note],
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        toolLevel,
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
