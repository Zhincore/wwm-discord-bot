import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

import { snowflake } from '#common/database/schema.helpers.js';

import { ToolLevel } from './utils/tool-agent';

export const llmRoles = sqliteTable(
  'guild_llm_whitelist',
  {
    guildId: snowflake().notNull(),
    roleId: snowflake().notNull(),
    level: t
      .text({ enum: ['BASIC', 'ADVANCED'] })
      .$type<ToolLevel>()
      .notNull()
      .default('BASIC'),
  },
  (table) => [
    t.uniqueIndex('guild_level_index').on(table.guildId, table.level),
  ],
);
