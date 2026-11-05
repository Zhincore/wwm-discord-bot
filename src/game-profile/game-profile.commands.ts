import { Injectable } from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentData,
  EmbedBuilder,
  InteractionContextType,
  MessageActionRowComponentData,
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

import { GameProfileService } from './game-profile.service';

@SlashCommand({
  name: 'wwm-stats',
  description: 'See or link WWM game stats.',
  contexts: [InteractionContextType.Guild],
})
@Injectable()
export class GameProfileCommands {
  constructor(private readonly service: GameProfileService) {}

  @UserCommand({
    name: 'Show WWM stats',
  })
  public async view(
    @Context() [interaction]: UserCommandContext,
    @TargetUser() user: User,
  ) {
    const profile = await this.service.getProfile(user.id);

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(
            `${user.username}'s' ${profile?.roleName} ${profile?.bodyType}`,
          )
          .setImage(user.displayAvatarURL({ size: 4096 })),
      ],
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
      flags: ['IsComponentsV2'],
      components: [
        new TextDisplayBuilder().setContent(
          'To link your WWM character, pick your login method:',
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
