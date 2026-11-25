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

export class PlayerAppearedNotifier extends BaseNotificationsNotifier<'player_appeared'> {
  @Inject()
  private readonly gameData: GameDataService;

  public override getKind(): 'player_appeared' {
    return 'player_appeared';
  }

  protected override async onEvent(
    event: WwmEvent<'player_appeared'>,
    guilds: GuildSetting[],
  ): Promise<void> {
    if (!event.name) return;

    const embed = new EmbedBuilder()
      .setColor('Purple')
      .setTitle(`${event.name}  [lvl. ${event.level ?? '??'}]`)
      .setFields({
        name: 'Guild',
        value: event.guild_name || '-',
        inline: true,
      });

    const avatar = this.gameData.get(
      'avatar',
      event.player?.avatar_image_id || DEFAULT_AVATAR,
    );
    if (avatar?.pic_url) embed.setThumbnail(avatar.pic_url);

    for (const guild of guilds) {
      await guild.channel.send({
        flags: ['IsComponentsV2'],
        content:
          `## A player appeared in our guild base\n` +
          (guild.pingRole ? guild.pingRole : ''),
        embeds: [embed],
      });
    }
  }
}
