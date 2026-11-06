import { Injectable } from '@nestjs/common';
import {
  GuildBasedChannel,
  GuildChannel,
  InteractionContextType,
  PermissionFlagsBits,
  Role,
} from 'discord.js';
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
  defaultMemberPermissions: [PermissionFlagsBits.Administrator],
})
@Injectable()
export class CodesCommands {
  constructor(private readonly service: CodesService) {}

  private renderSettings(
    channel: GuildChannel | GuildBasedChannel | null,
    role?: Role | null,
  ) {
    const channelName = channel ?? '*<nonexistant>*';

    let roleName = role === null ? null : role?.name;
    if (roleName === null) roleName = '*<nonexistant>*';
    if (roleName === undefined) roleName = 'no';

    return `New codes notifications will be sent to ${channelName} with ${roleName} role pinged.`;
  }
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
      content: this.renderSettings(channel, role),
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

  @Subcommand({
    name: 'view',
    description: 'View the current exchange codes notification settings',
  })
  public async view(@Context() [interaction]: SlashCommandContext) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: `This is a guild-only command.`,
        flags: ['Ephemeral'],
      });
    }

    const settings = this.service.getGuildSettings(interaction.guildId);
    if (!settings) {
      return interaction.reply({
        content: 'Codes notifications are not enabled in this server.',
        flags: ['Ephemeral'],
      });
    }

    const guild = await interaction.client.guilds.fetch(interaction.guildId);
    const [channel, role] = await Promise.all([
      guild.channels.fetch(settings.channel),
      settings.pingRole ? guild.roles.fetch(settings.pingRole) : undefined,
    ]);

    return interaction.reply({
      content: this.renderSettings(channel, role),
      flags: ['Ephemeral'],
    });
  }
}
