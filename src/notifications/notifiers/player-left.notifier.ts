import { Inject } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';

import {
  DEFAULT_AVATAR,
  GameDataService,
} from '#game-data/game-data.service.ts';

import {
  BaseNotificationsNotifier,
  type GuildSetting,
  type WwmEvent,
} from './base';

export class PlayerLeftNotifier extends BaseNotificationsNotifier<'player_left'> {
  @Inject()
  private readonly gameData: GameDataService;

  public override getKind(): 'player_left' {
    return 'player_left';
  }

  protected override async onEvent(
    event: WwmEvent<'player_left'>,
    guilds: GuildSetting[],
  ): Promise<void> {
    if (!event.name) return;

    const duration = Temporal.Duration.from({ seconds: event.stayed_s });
    const embed = new EmbedBuilder()
      .setColor('DarkPurple')
      .setTitle(`${event.name}`)
      .setFields(
        {
          name: 'Guild',
          value: event.guild_name || '-',
          inline: true,
        },
        {
          name: 'Stayed for',
          value: duration.toLocaleString(),
          inline: true,
        },
      );

    const avatar = this.gameData.get(
      'avatar',
      event.head_image_id || DEFAULT_AVATAR,
    );
    if (avatar?.pic_url) embed.setThumbnail(avatar.pic_url);

    for (const guild of guilds) {
      await guild.channel.send({
        flags: ['IsComponentsV2'],
        content:
          `## A player left our guild base\n` +
          (guild.pingRole ? guild.pingRole : ''),
        embeds: [embed],
      });
    }
  }
}
