import { EmbedBuilder } from 'discord.js';

import {
  BaseNotificationsNotifier,
  type GuildSetting,
  type WwmEvent,
} from './base';

export class GuildwarOpponentNotifier extends BaseNotificationsNotifier<'guildwar_opponent'> {
  public override getKind(): 'guildwar_opponent' {
    return 'guildwar_opponent';
  }

  protected override async onEvent(
    event: WwmEvent<'guildwar_opponent'>,
    guilds: GuildSetting[],
  ): Promise<void> {
    if (!event.name) return;

    const fields = {
      Level: event.level,
      Rank: event.rank,
      Score: event.score?.toLocaleString(),
      Wins: event.win_count,
    };

    const embed = new EmbedBuilder()
      .setColor('DarkOrange')
      .setTitle(event.name)
      .setFields(
        ...Object.entries(fields)
          .filter((v) => v[1])
          .map(
            ([name, value]) =>
              ({ name, value: value + '', inline: true }) as const,
          ),
      );

    for (const guild of guilds) {
      await guild.channel.send({
        flags: ['IsComponentsV2'],
        content:
          `## Opponent for next Guild War League has been selected\n` +
          (guild.pingRole ? guild.pingRole : ''),
        embeds: [embed],
      });
    }
  }
}
