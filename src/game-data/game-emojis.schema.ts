import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

export const gameDataEmojis = sqliteTable('game_data_emojis', {
  name: t.text().primaryKey(),
  url: t.text().notNull(),
});
