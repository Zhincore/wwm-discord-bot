import { Injectable } from '@nestjs/common';
import { InteractionContextType } from 'discord.js';
import {
  Context,
  Options,
  SlashCommand,
  Subcommand,
  type SlashCommandContext,
} from 'necord';

import { PlayerDto } from './dto/player.dto';
import { WwmService } from './wwm.service';

@SlashCommand({
  name: 'wwm',
  description: 'See or link WWM game stats.',
  contexts: [InteractionContextType.Guild],
})
@Injectable()
export class WwmCommands {
  constructor(private readonly service: WwmService) {}

  @Subcommand({
    name: 'guild',
    description: 'See guild info',
  })
  public async guild(
    @Context() [interaction]: SlashCommandContext,
    @Options() { who }: PlayerDto,
  ) {
    const player = await this.service.fetchPlayer(who);
    return interaction.reply({
      flags: ['Ephemeral'],
      content: '```json\n' + JSON.stringify(player) + '\n```',
    });
  }
}
