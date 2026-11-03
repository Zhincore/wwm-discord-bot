import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  ChannelManager,
  ChannelType,
  Client,
  EmbedBuilder,
  Snowflake,
} from 'discord.js';
import { eq, sql } from 'drizzle-orm';

import { DatabaseService } from '#common/database/database.service.js';
import { KvStore } from '#common/database/kv-store.service.js';

import { guildCodesTable } from './codes.schema.js';
import { fetchYarCodes } from './sources/yar.js';

@Injectable()
export class CodesService {
  // TODO: Lock
  private fetching = false;

  #iterateGuilds;
  #enableCodes;
  #disableCodes;

  constructor(
    db: DatabaseService,
    private readonly store: KvStore<{ lastCursor?: string }>,
    private readonly discord: Client,
    private readonly channels: ChannelManager,
  ) {
    const guildId = sql.placeholder('guildId');
    const channel = sql.placeholder('channel');
    const role = sql.placeholder('role');

    this.#iterateGuilds = db.select().from(guildCodesTable).prepare();
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

  @Cron('0 */30 9-23 * * *')
  async checkCodes() {
    const codes = await this.fetchCodes();

    if (!codes.length) return;

    for (const guild of this.#iterateGuilds.all()) {
      const channel = await this.channels.fetch(guild.channel);
      if (!channel?.isSendable() || channel.type !== ChannelType.GuildText)
        continue;

      const role = guild.pingRole
        ? await channel.guild.roles.fetch(guild.pingRole)
        : null;

      const codesLimited = codes.slice(0, 16);
      const codesMore = codes.length - codesLimited.length;

      await channel.send({
        content: 'New exchange codes!' + (role ? ` ${role}` : ''),
        embeds: [
          new EmbedBuilder()
            .setColor('Green')
            .setTitle('New exchange codes')
            .setDescription(
              codesLimited.map((c) => `\`${c}\``).join('\n') +
                (codesMore
                  ? `\n\n[And ${codesMore} more...](https://codes.yar.gg/)`
                  : ''),
            )
            .setFields({
              name: 'Source',
              value: '[codes.yar.gg](https://codes.yar.gg/)',
              inline: true,
            }),
        ],
      });
    }
  }

  private async fetchCodes(): Promise<string[]> {
    const lastCursor = this.store.get('lastCursor');

    const result = await fetchYarCodes(lastCursor);

    this.store.set('lastCursor', result.latestCursor);

    return result.codes;
  }

  public async enableCodes(
    guildId: Snowflake,
    channel: Snowflake,
    role?: Snowflake,
  ) {
    await this.#enableCodes.execute({
      guildId,
      channel,
      role,
    });
  }
}
