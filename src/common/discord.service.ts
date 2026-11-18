import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'discord.js';

@Injectable()
export class DiscordService {
  #logger = new Logger('Discord.js');

  constructor(private readonly client: Client) {
    client.on('error', (error) => {
      this.#logger.error(error);
    });
  }
}
