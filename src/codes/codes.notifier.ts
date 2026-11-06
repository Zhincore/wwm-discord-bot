import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ChannelManager, ChannelType, EmbedBuilder } from 'discord.js';

import { CodesService } from './codes.service';

@Injectable()
export class CodesNotifier {
  constructor(
    private readonly service: CodesService,
    private readonly channels: ChannelManager,
  ) {}

  @Cron('0 */30 9-23 * *')
  async checkCodes() {
    const codes = await this.service.fetchCodes();

    if (!codes.length) return;

    for (const guild of this.service.getGuilds()) {
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
        allowedMentions: { roles: role ? [role.id] : [] },
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
}
