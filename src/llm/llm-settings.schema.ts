import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

import { guildId, snowflake } from '#common/database/schema.helpers.js';

import { ToolLevel } from './tool-agent';

export const llmRoles = sqliteTable(
  'guild_llm_whitelist',
  {
    guildId: guildId(),
    roleId: snowflake().notNull(),
    level: t
      .text({ enum: ['BASIC', 'ADVANCED'] })
      .$type<ToolLevel>()
      .notNull()
      .default(ToolLevel.BASIC),
  },
  (table) => [
    t.uniqueIndex('guild_level_index').on(table.guildId, table.level),
  ],
);
