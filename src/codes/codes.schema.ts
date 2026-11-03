import * as t from 'drizzle-orm/sqlite-core';

import { guildId, snowflake } from '#common/database/schema.helpers.js';

export const guildCodesTable = t.sqliteTable('codes', {
  guildId: guildId(),
  channel: snowflake().notNull(),
  pingRole: snowflake(),
});
