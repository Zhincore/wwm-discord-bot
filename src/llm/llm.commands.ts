import { Injectable } from '@nestjs/common';
import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import {
  Context,
  Options,
  SlashCommand,
  Subcommand,
  type SlashCommandContext,
} from 'necord';

import { DisableLLMDto } from './dto/disable-llm.dto';
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
    @Options() { level, role }: EnableLLMDto,
  ) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `This is a guild-only command.`,
        flags: ['Ephemeral'],
      });
    }

    const inserted = this.service.enable(interaction.guildId, level, role?.id);
    return interaction.reply({
      flags: ['Ephemeral'],
      content:
        (inserted ? '' : 'Settings changed to ') +
        level +
        ' LLM enabled for ' +
        (role?.name || 'everyone'),
    });
  }

  @Subcommand({
    name: 'disable',
    description: 'Disable LLM usage for the server.',
  })
  async disable(
    @Context() [interaction]: SlashCommandContext,
    @Options() { level }: DisableLLMDto,
  ) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `This is a guild-only command.`,
        flags: ['Ephemeral'],
      });
    }

    const changed = this.service.disable(interaction.guildId, level);
    return interaction.reply({
      flags: ['Ephemeral'],
      content:
        (level ? level + ' ' : '') +
        'LLM usage ' +
        (changed ? 'now' : 'was already') +
        ' disabled.',
    });
  }
}
