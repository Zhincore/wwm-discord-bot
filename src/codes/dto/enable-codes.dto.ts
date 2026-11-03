import { ChannelType, GuildChannel, Role } from 'discord.js';
import { ChannelOption, RoleOption } from 'necord';

export class EnableCodesDto {
  @ChannelOption({
    name: 'channel',
    description: 'Which channel to send notifications into',
    channel_types: [ChannelType.GuildText],
    required: true,
  })
  public readonly channel!: GuildChannel;

  @RoleOption({
    name: 'role',
    description: 'Which role to ping when new codes arrive (optional)',
    required: false,
  })
  public readonly role?: Role;
}
