import { Injectable } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionContextType,
  TextDisplayBuilder,
  User,
} from 'discord.js';
import {
  Context,
  SlashCommand,
  type SlashCommandContext,
  Subcommand,
  TargetUser,
  UserCommand,
  type UserCommandContext,
} from 'necord';

import { WwmMartialArt } from '#wwm/game-data.client.js';
import { GameEmojisService } from '#wwm/game-emojis.service.js';

import { GameProfileService } from './game-profile.service';

const HOUR = 1000 * 60 * 60;

@SlashCommand({
  name: 'wwm-stats',
  description: 'See or link WWM game stats.',
  contexts: [InteractionContextType.Guild],
})
@Injectable()
export class GameProfileCommands {
  constructor(
    private readonly service: GameProfileService,
    private readonly emoji: GameEmojisService,
  ) {}

  @UserCommand({
    name: 'Show WWM stats',
  })
  public async view(
    @Context() [interaction]: UserCommandContext,
    @TargetUser() user: User,
  ) {
    const profile = await this.service.getResolvedProfile(user.id);
    if (!profile) {
      return interaction.reply({
        content: `${user} doesn't have linked WWM stats or the session expired.`,
        allowedMentions: { parse: [] },
      });
    }

    const getMartialArt = (art?: WwmMartialArt) => {
      if (!art) return '-';
      const pathEmoji =
        (art.liupai_pic_url && this.emoji.getPathEmoji(art.liupai_pic_url)) ||
        '🛡️';
      const artEmoji = this.emoji.getMartialArtEmoji(art) || '🛡️';
      return `${pathEmoji} | ${artEmoji} ${art.name ?? '???'}`;
    };

    const inline = true;
    const embed = new EmbedBuilder()
      .setColor('Gold')
      .setAuthor({
        name: `${user.displayName}`,
        iconURL: user.avatarURL({ size: 256 }) || undefined,
      })
      .setTitle(`${profile.name} [lvl. ${profile.level}]`)
      .setFields([
        {
          name: 'Playtime',
          value: `${Math.round(profile.onlineTimeMs / HOUR).toLocaleString()} (${profile.createdDays} d)`,
          inline,
        },
        {
          name: 'Martial Mastery',
          value: `${profile.maxMartialMastery.toLocaleString()}`,
          inline,
        },
        {
          name: 'Elegance',
          value: `*${profile.eleganceLevel.name}* [${profile.eleganceScore.toLocaleString()}]`,
          inline,
        },
        {
          name: 'Weapons',
          value: `${getMartialArt(profile.mainMartialArt)}\n${getMartialArt(profile.subMartialArt)}`,
        },
      ]);
    if (profile.avatarUrl) embed.setThumbnail(profile.avatarUrl);

    return interaction.reply({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }

  @Subcommand({
    name: 'link',
    description: 'Link your in-game WWM character to the bot',
  })
  public async link(@Context() [interaction]: SlashCommandContext) {
    const methods = await this.service.getLoginMethodsDiscord(
      interaction.user.id,
    );

    return interaction.reply({
      flags: ['IsComponentsV2', 'Ephemeral'],
      components: [
        new TextDisplayBuilder().setContent(
          'To link your WWM character, pick your login method:' +
            '\n-# Note that these link are specific to you, DO NOT share them.',
        ),
        ...methods
          .reduce(
            (acc, m) => {
              let arr = acc[acc.length - 1];
              if (arr.length == 5) {
                arr = [];
                acc.push(arr);
              }
              arr.push(
                new ButtonBuilder()
                  .setStyle(ButtonStyle.Link)
                  .setLabel(m.name)
                  .setURL(m.url),
              );
              return acc;
            },
            [[]] as ButtonBuilder[][],
          )
          .map((c) => new ActionRowBuilder<ButtonBuilder>().setComponents(c)),
      ],
    });
  }
}
