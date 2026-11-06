import { Injectable, Logger } from '@nestjs/common';
import { Snowflake } from 'discord.js';
import { eq, sql } from 'drizzle-orm';

import { DatabaseService } from '#common/database/database.service.js';
import { KvStore } from '#common/database/kv-store.service.js';

import { guildCodesTable } from './codes.schema.js';
import { fetchYarCodes } from './sources/yar.js';

@Injectable()
export class CodesService {
  private readonly logger = new Logger(CodesService.name);
  // TODO: Lock
  private fetching = false;

  #iterateGuilds;
  #getGuild;
  #enableCodes;
  #disableCodes;

  constructor(
    db: DatabaseService,
    private readonly store: KvStore<{ lastCursor?: string }>,
  ) {
    const guildId = sql.placeholder('guildId');
    const channel = sql.placeholder('channel');
    const role = sql.placeholder('role');

    this.#iterateGuilds = db.select().from(guildCodesTable).prepare();
    this.#getGuild = db
      .select()
      .from(guildCodesTable)
      .where(eq(guildCodesTable.guildId, guildId))
      .prepare();
    this.#enableCodes = db
      .insert(guildCodesTable)
      .values({ guildId, channel, pingRole: role })
      .onConflictDoUpdate({
        target: guildCodesTable.guildId,
        set: { channel, pingRole: role },
      })
      .prepare();
    this.#disableCodes = db
      .delete(guildCodesTable)
      .where(eq(guildCodesTable.guildId, guildId))
      .prepare();
  }

  public async fetchCodes(): Promise<string[]> {
    this.logger.log('Fetching codes...');
    const lastCursor = this.store.get('lastCursor');

    const result = await fetchYarCodes(lastCursor);

    this.store.set('lastCursor', result.latestCursor);

    this.logger.log(
      `Fetching codes done, found ${result.codes.length} new codes.`,
    );
    return result.codes;
  }

  public getGuilds() {
    return this.#iterateGuilds.all();
  }

  public getGuildSettings(guildId: Snowflake) {
    return this.#getGuild.get({ guildId });
  }

  public enableNotifications(
    guildId: Snowflake,
    channel: Snowflake,
    role?: Snowflake,
  ) {
    this.#enableCodes
      .execute({
        guildId,
        channel,
        role,
      })
      .sync();
  }

  public disableNotifications(guildId: Snowflake) {
    this.#disableCodes.execute({ guildId }).sync();
  }
}
