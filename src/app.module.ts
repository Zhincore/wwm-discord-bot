import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { IntentsBitField } from 'discord.js';
import { NecordModule } from 'necord';

import { LLMModule } from '#llm/llm.module.js';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CodesModule } from './codes/codes.module.js';
import { CommonModule } from './common/common.module.js';
import { GameProfileModule } from './game-profile/game-profile.module.js';
import { WwmModule } from './wwm/wwm.module.js';

const devGuild = process.env['DISCORD_DEVELOPMENT_GUILD_ID']?.trim();

@Module({
  imports: [
    // Vendor
    ScheduleModule.forRoot(),
    NecordModule.forRoot({
      token: process.env['DISCORD_TOKEN']!,
      intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
      ],
      development: devGuild ? [devGuild] : undefined,
    }),

    // Internal
    CommonModule,
    CodesModule,
    // GameProfileModule,
    WwmModule,
    LLMModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
