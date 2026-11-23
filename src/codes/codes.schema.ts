import * as t from 'drizzle-orm/sqlite-core';

import { snowflake } from '#common/database/schema.helpers.js';

export const guildCodesTable = t.sqliteTable('codes', {
  guildId: snowflake().primaryKey(),
  channel: snowflake().notNull(),
  pingRole: snowflake(),
});
