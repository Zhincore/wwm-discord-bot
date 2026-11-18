import { StringOption } from 'necord';

export class PlayerDto {
  @StringOption({
    name: 'who',
    description: 'Name or UID of the player to look up',
    required: true,
  })
  public who: string;
}
