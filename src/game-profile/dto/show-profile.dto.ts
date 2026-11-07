import { GuildMember } from 'discord.js';
import { MemberOption } from 'necord';

export class ShowProfileDto {
  @MemberOption({
    name: 'of',
    description: 'Whose profile to show, your if unspecified.',
    required: false,
  })
  public readonly of?: GuildMember;
}
