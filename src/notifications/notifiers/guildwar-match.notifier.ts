import { EmbedBuilder } from 'discord.js';

import { GUILD_NAME } from '#consts.ts';
import type { GuildWarMode, GuildWarPlayer } from '#wwm/proxy/wwm-api.js';

import {
  BaseNotificationsNotifier,
  type GuildSetting,
  type WwmEvent,
} from './base';

export class GuildwarMatchNotifier extends BaseNotificationsNotifier<'guildwar_match'> {
  public override getKind(): 'guildwar_match' {
    return 'guildwar_match';
  }

  protected override async onEvent(
    event: WwmEvent<'guildwar_match'>,
    guilds: GuildSetting[],
  ): Promise<void> {
    const mode = (
      {
        league: 'League',
        matchmaking: 'Ranked',
        invite: '',
      } as Record<GuildWarMode, string>
    )[event.mode];

    let mostKills: GWPlayerScore | undefined;
    let mostDamage: GWPlayerScore | undefined;
    let mostHeals: GWPlayerScore | undefined;
    let mostDeaths: GWPlayerScore | undefined;
    let mostFinances: GWPlayerScore | undefined;
    let mvp: GuildWarPlayer | undefined;
    let isMatchMVP = false;

    for (const player of event.players) {
      if (player.team_mvp) {
        isMatchMVP = player.mvp || false;
        mvp = player;
      }
      mostKills = better(player.kills, player, mostKills);
      mostDamage = better(player.total_damage, player, mostDamage);
      mostHeals = better(player.healing_done, player, mostHeals);
      mostDeaths = better(player.deaths, player, mostDeaths);
      mostFinances = better(player.baiye_token, player, mostFinances);
    }

    let scoreText = '';
    if (event.score.new && event.score.old) {
      const scoreChange = (event.score.new - event.score.old).toLocaleString(
        undefined,
        { signDisplay: 'always' },
      );
      scoreText = `Our new score: ${event.score.new.toLocaleString()} (${scoreChange})`;
    }

    const field = (name: string, player?: GWPlayerScore | GuildWarPlayer) => ({
      name,
      value: Array.isArray(player)
        ? playerScore(player)
        : (player?.name ?? '-'),
      inline: true,
    });

    const content = `## Guild War ${mode} match ${event.win ? 'won!' : 'lost'}`;
    const embed = new EmbedBuilder()
      .setColor(event.win ? 'Green' : 'DarkRed')
      .setTitle(
        `${GUILD_NAME}  ${event.players.length} vs. ${event.enemy_count}  ${event.enemy.name}`,
      )
      .setDescription(scoreText)
      .setFields(
        field(isMatchMVP ? 'Match MVP' : 'Our MVP', mvp),
        field('Most damage', mostDamage),
        field('Most kills', mostKills),
        field('Most healing', mostHeals),
        field('Most deaths', mostDeaths),
        field('Most jungling', mostFinances),
      );

    for (const guild of guilds) {
      await guild.channel.send({
        flags: ['IsComponentsV2'],
        content: content + `\n` + (guild.pingRole ? guild.pingRole : ''),
        embeds: [embed],
      });
    }
  }
}

type GWPlayerScore = [score: number, player: GuildWarPlayer];
function better(
  score: number,
  player: GuildWarPlayer,
  previous?: GWPlayerScore,
): GWPlayerScore {
  if (score > (previous?.[0] ?? -Infinity)) return [score, player];
  return previous!;
}

function playerScore(score?: GWPlayerScore) {
  if (!score?.[0] || !score[1].name) return '-';

  return `${score[1].name} (${score[0].toLocaleString()})`;
}
