import { InteractionContextType, PermissionFlagsBits } from 'discord.js';
import {
  Context,
  Options,
  SlashCommand,
  Subcommand,
  type SlashCommandContext,
} from 'necord';

import { DisableNotificationsDto } from './dto/disable-notifications.dto';
import { EnableNotificationsDto } from './dto/enable-notifications.dto';
import { NotificationsService } from './notifications.service';

@SlashCommand({
  name: 'notifs',
  description: 'Set-up notifications for game events.',
  contexts: [InteractionContextType.Guild],
  defaultMemberPermissions: [PermissionFlagsBits.Administrator],
})
export class NotificationsCommands {
  constructor(private readonly service: NotificationsService) {}

  @Subcommand({
    name: 'enable',
    description: 'Enable notifications of given type.',
  })
  public async enable(
    @Context() [interaction]: SlashCommandContext,
    @Options() { kind, channel, role }: EnableNotificationsDto,
  ) {
    if (!interaction.inGuild()) return;

    const inserted = this.service.enableNotifications(
      interaction.guildId,
      kind,
      channel.id,
      role?.id,
    );
    return interaction.reply({
      flags: ['Ephemeral'],
      content: `Notifications for \`${kind}\` **${inserted ? 'enabled' : 'changed'}** to ${channel} with ${role?.name || 'no'} role pinged.`,
    });
  }

  @Subcommand({
    name: 'disable',
    description: 'Disable notifications of given type.',
  })
  public async disable(
    @Context() [interaction]: SlashCommandContext,
    @Options() { kind }: DisableNotificationsDto,
  ) {
    if (!interaction.inGuild()) return;

    const changed = this.service.disableNotifications(
      interaction.guildId,
      kind,
    );
    return interaction.reply({
      flags: ['Ephemeral'],
      content: `Notifications for \`${kind}\` **${changed ? 'have been disabled' : "weren't enabled before."}** .`,
    });
  }

  // @Subcommand({
  //   name: 'preview',
  //   description: 'Preview a notification of given type.',
  // })
  // public async preview(
  //   @Context() [interaction]: SlashCommandContext,
  //   @Options() { kind }: DisableNotificationsDto,
  // ) {
  //   if (!interaction.inGuild()) return;

  //   const notifier = this.service.getNotifier(kind);
  //   if (!notifier) return;

  //   const reply = await notifier.previewEvent([interaction]);
  //   if (!reply) {
  //     return interaction.reply({
  //       flags: 'Ephemeral',
  //       content: 'Preview notification sent.',
  //     });
  //   }

  //   return interaction.reply(reply as InteractionReplyOptions);
  // }
}
