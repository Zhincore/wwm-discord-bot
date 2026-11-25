import { ChannelType, Role, TextChannel } from 'discord.js';
import { ChannelOption, RoleOption, StringOption } from 'necord';

import { arrayToChoices } from '#common/utils.ts';

import { NotificationKind } from '../notifiers';

export class EnableNotificationsDto {
  @StringOption({
    name: 'kind',
    description: 'What kind of event to enable',
    choices: arrayToChoices(NotificationKind),
    required: true,
  })
  kind: NotificationKind;

  @ChannelOption({
    name: 'channel',
    description: 'Where to send the notifications',
    channel_types: [ChannelType.GuildText],
    required: true,
  })
  channel: TextChannel;

  @RoleOption({
    name: 'role',
    description: 'Optional role to ping with new notifications',
    required: false,
  })
  role?: Role;
}
