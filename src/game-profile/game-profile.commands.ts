import { Injectable } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelManager,
  CommandInteraction,
  EmbedBuilder,
  GuildMember,
  InteractionContextType,
  Snowflake,
  TextDisplayBuilder,
} from 'discord.js';
import {
  Context,
  Options,
  SlashCommand,
  type SlashCommandContext,
  Subcommand,
  TargetMember,
  UserCommand,
  type UserCommandContext,
} from 'necord';

import { WwmMartialArt } from '#wwm/game-data.client.js';
import { GameEmojisService } from '#wwm/game-emojis.service.js';

import { ShowProfileDto } from './dto/show-profile.dto';
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
    private readonly channels: ChannelManager,
  ) {
    service.on('profileLinked', (nickname, linkMessageId) => {
      if (linkMessageId) return this.updateLinkMessage(nickname, linkMessageId);
    });
  }

  @UserCommand({
    name: 'Show WWM stats',
  })
  public async view(
    @Context() [interaction]: UserCommandContext,
    @TargetMember() member: GuildMember,
  ) {
    return this.replyProfile(interaction, member);
  }

  @Subcommand({
    name: 'show',
    description: "Show your or someone's WWM profile.",
  })
  public async show(
    @Context() [interaction]: SlashCommandContext,
    @Options() { of }: ShowProfileDto,
  ) {
    if (!interaction.inCachedGuild()) return;
    const member = of ?? interaction.member;
    if (!member) return;
    return this.replyProfile(interaction, member);
  }

  @Subcommand({
    name: 'link',
    description: 'Link your in-game WWM character to the bot',
  })
  public async link(@Context() [interaction]: SlashCommandContext) {
    const methods = await this.service.getLoginMethodsDiscord(
      interaction.user.id,
    );

    const response = await interaction.reply({
      flags: ['IsComponentsV2', 'Ephemeral'],
      components: [
        new TextDisplayBuilder().setContent(
          'To (re)link your WWM character, pick your login method:' +
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

    const messageId = interaction.channelId + ':' + response.id;
    this.service.setLinkMessage(interaction.user.id, messageId);

    return response;
  }

  private async updateLinkMessage(nickname: string, linkMessage: Snowflake) {
    const [channelId, messageId] = linkMessage.split(':');

    const channel = await this.channels.fetch(channelId);
    if (!channel?.isTextBased()) return;

    return await channel.messages
      .edit(messageId, {
        components: [
          new TextDisplayBuilder().setContent(
            `Successfuly linked character ${nickname} to your Discord!`,
          ),
        ],
      })
      .catch(() => null);
  }

  private async replyProfile(
    interaction: CommandInteraction,
    member: GuildMember,
  ) {
    const profile = await this.renderProfile(member);
    if (!profile) {
      return interaction.reply({
        content: `${member} doesn't have linked WWM stats or the session expired.`,
        allowedMentions: { parse: [] },
      });
    }

    return interaction.reply({
      embeds: [profile],
      allowedMentions: { parse: [] },
    });
  }

  private async renderProfile(member: GuildMember) {
    const profile = await this.service.getResolvedProfile(member.user.id);
    if (!profile) return;

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
        name: `${member.nickname || member.displayName}`,
        iconURL: member.displayAvatarURL({ size: 128 }),
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

    return embed;
  }
}
