import type { Snowflake } from 'discord.js';
import * as t from 'drizzle-orm/sqlite-core';

export const boolean = () => t.integer({ mode: 'boolean' });

export const snowflake = () => t.text().$type<Snowflake>();
