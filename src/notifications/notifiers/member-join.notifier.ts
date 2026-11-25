import { Inject } from '@nestjs/common';
import { EmbedBuilder } from 'discord.js';

import {
  DEFAULT_AVATAR,
  GameDataService,
} from '#game-data/game-data.service.ts';
import { mastery } from '#wwm/utils.ts';

import {
  BaseNotificationsNotifier,
  type GuildSetting,
  type WwmEvent,
} from './base';

export class MemberJoinNotifier extends BaseNotificationsNotifier<'guild_member_joined'> {
  @Inject()
  private readonly gameData: GameDataService;

  public override getKind(): 'guild_member_joined' {
    return 'guild_member_joined';
  }

  protected override async onEvent(
    event: WwmEvent<'guild_member_joined'>,
    guilds: GuildSetting[],
  ): Promise<void> {
    if (!event.name) return;

    const avatar = this.gameData.get(
      'avatar',
      event.head_image_id || DEFAULT_AVATAR,
    );

    const info = [
      event.level && `Level: ${event.level}`,
      event.player?.mastery && mastery(event.player?.mastery),
      event.player?.region,
      event.player?.language,
    ]
      .filter((v) => v)
      .join('|');

    const embed = new EmbedBuilder()
      .setColor('Green')
      .setTitle(event.name)
      .setDescription(info);
    if (avatar?.pic_url) embed.setThumbnail(avatar.pic_url);

    for (const guild of guilds) {
      await guild.channel.send({
        flags: ['IsComponentsV2'],
        content:
          `## New member has joined the guild!\n` +
          (guild.pingRole ? guild.pingRole : ''),
        embeds: [embed],
      });
    }
  }
}
