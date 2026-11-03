import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Namespaced key/value store for non-guild state (cursors, flags, caches). */
export const appState = sqliteTable('app_state', {
  key: text().primaryKey(),
  value: text({ mode: 'json' }).notNull(),
});
