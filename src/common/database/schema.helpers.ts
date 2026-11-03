import { Snowflake } from 'discord.js';
import * as t from 'drizzle-orm/sqlite-core';

export const snowflake = () => t.text().$type<Snowflake>();

export const guildId = () => snowflake().primaryKey();
