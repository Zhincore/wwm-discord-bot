import { sql } from 'drizzle-orm';
import { sqliteTable } from 'drizzle-orm/sqlite-core';
import * as t from 'drizzle-orm/sqlite-core';

import { snowflake } from '#common/database/schema.helpers.js';

export const gameProfiles = sqliteTable('game_profiles', {
  id: t.integer().primaryKey({ autoIncrement: true }),
  memberId: snowflake().unique(),
  session: t.text(),
  createdAt: t.integer({ mode: 'timestamp' }).default(sql`(CURRENT_TIMESTAMP)`),
});
