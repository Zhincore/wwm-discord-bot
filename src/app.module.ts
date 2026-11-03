import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IntentsBitField } from 'discord.js';
import { NecordModule } from 'necord';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CodesModule } from './codes/codes.module.js';
import { CommonModule } from './common/common.module.js';

@Module({
  imports: [
    // Vendor
    ScheduleModule.forRoot(),
    NecordModule.forRoot({
      token: process.env.DISCORD_TOKEN!,
      intents: [IntentsBitField.Flags.Guilds],
      development: [process.env.DISCORD_DEVELOPMENT_GUILD_ID!],
    }),

    // Internal
    CommonModule,
    CodesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
