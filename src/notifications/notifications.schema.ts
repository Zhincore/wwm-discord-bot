import * as t from 'drizzle-orm/sqlite-core';

import { snowflake } from '#common/database/schema.helpers.js';

export const notificationsTable = t.sqliteTable(
  'notifications',
  {
    guildId: snowflake().notNull(),
    kind: t.text().notNull(),
    channel: snowflake().notNull(),
    pingRole: snowflake(),
  },
  (table) => [t.primaryKey({ columns: [table.guildId, table.kind] })],
);
