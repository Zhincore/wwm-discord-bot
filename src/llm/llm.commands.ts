import { Injectable } from '@nestjs/common';
import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import {
  Context,
  Options,
  SlashCommand,
  Subcommand,
  type SlashCommandContext,
} from 'necord';

import { EnableLLMDto } from './dto/enable-llm.dto';
import { LLMService } from './llm.service';

@SlashCommand({
  name: 'llm',
  description: 'Control the LLM mode of the bot',
  contexts: [InteractionContextType.Guild],
  defaultMemberPermissions: [PermissionFlagsBits.Administrator],
})
@Injectable()
export class LLMCommands {
  constructor(private readonly service: LLMService) {}

  // @Subcommand({
  //   name: 'ask',
  //   description: 'Ask the LLM a question.',
  // })
  // async ask(
  //   @Context() [interaction]: SlashCommandContext,
  //   @Options() { role }: EnableLLMDto,
  // ) { }

  @Subcommand({
    name: 'enable',
    description: 'Enable LLM usage for all or specific role.',
  })
  async enable(
    @Context() [interaction]: SlashCommandContext,
    @Options() { role }: EnableLLMDto,
  ) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `This is a guild-only command.`,
        flags: ['Ephemeral'],
      });
    }

    const inserted = this.service.enable(interaction.guildId, role?.id);
    return interaction.reply({
      flags: ['Ephemeral'],
      content:
        (inserted ? '' : 'Settings changed to ') +
        'LLM enabled for ' +
        (role || 'everyone'),
    });
  }

  @Subcommand({
    name: 'disable',
    description: 'Disable LLM usage for the server.',
  })
  async disable(@Context() [interaction]: SlashCommandContext) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `This is a guild-only command.`,
        flags: ['Ephemeral'],
      });
    }

    this.service.disable(interaction.guildId);
    return interaction.reply({
      flags: ['Ephemeral'],
      content: 'LLM usage disabled',
    });
  }
}
