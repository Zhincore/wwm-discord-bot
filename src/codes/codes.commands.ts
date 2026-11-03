import { Injectable } from '@nestjs/common';
import { InteractionContextType } from 'discord.js';
import {
  Context,
  Options,
  SlashCommand,
  Subcommand,
  type SlashCommandContext,
} from 'necord';

import { CodesService } from './codes.service.js';
import { EnableCodesDto } from './dto/enable-codes.dto.js';

@SlashCommand({
  name: 'codes',
  description: 'Exchange codes notifications',
  contexts: [InteractionContextType.Guild],
})
@Injectable()
export class CodesCommands {
  constructor(private readonly service: CodesService) {}

  @Subcommand({
    name: 'enable',
    description: 'Enable or change exchange codes notifications',
  })
  public enable(
    @Context() [interaction]: SlashCommandContext,
    @Options() { channel, role }: EnableCodesDto,
  ) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `This is a guild-only command.`,
        flags: ['Ephemeral'],
      });
    }

    this.service.enableNotifications(interaction.guildId, channel.id, role?.id);

    return interaction.reply({
      content: `New codes notifications will be sent to ${channel} with ${role?.name || 'no'} role pinged.`,
      flags: ['Ephemeral'],
    });
  }

  @Subcommand({
    name: 'disable',
    description: 'Disable exchange codes notifications',
  })
  public disable(@Context() [interaction]: SlashCommandContext) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `This is a guild-only command.`,
        flags: ['Ephemeral'],
      });
    }

    this.service.disableNotifications(interaction.guildId);

    return interaction.reply({
      content: `New codes notifications disabled.`,
      flags: ['Ephemeral'],
    });
  }
}
