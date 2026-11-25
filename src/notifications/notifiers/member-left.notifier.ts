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

export class MemberLeftNotifier extends BaseNotificationsNotifier<'guild_member_left'> {
  @Inject()
  private readonly gameData: GameDataService;

  public override getKind(): 'guild_member_left' {
    return 'guild_member_left';
  }

  protected override async onEvent(
    event: WwmEvent<'guild_member_left'>,
    guilds: GuildSetting[],
  ): Promise<void> {
    if (!event.name) return;

    const avatar = this.gameData.get(
      'avatar',
      event.head_image_id || DEFAULT_AVATAR,
    );

    const embed = new EmbedBuilder().setColor('Red').setTitle(event.name);
    if (avatar?.pic_url) embed.setThumbnail(avatar.pic_url);

    for (const guild of guilds) {
      await guild.channel.send({
        flags: ['IsComponentsV2'],
        content:
          `## A member has left the guild\n` +
          (guild.pingRole ? guild.pingRole : ''),
        embeds: [embed],
      });
    }
  }
}
