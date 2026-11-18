import { sqliteTable } from 'drizzle-orm/sqlite-core';

import { guildId, snowflake } from '#common/database/schema.helpers.js';

export const llmRoles = sqliteTable('guild_llm_whitelist', {
  guildId: guildId(),
  roleId: snowflake(),
});
