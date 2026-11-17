import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

export const gameData = sqliteTable(
  'game_data',
  {
    kind: t.text().notNull(),
    id: t.integer().notNull(),
    name: t.text(),
    data: t.text({ mode: 'json' }).notNull(),
  },
  (table) => [t.primaryKey({ columns: [table.kind, table.id] })],
);
