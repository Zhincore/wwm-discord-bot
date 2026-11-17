import { Module } from '@nestjs/common';

import { GameDataModule } from '#game-data/game-data.module.js';

import { WwmCommands } from './wwm.commands.js';
import { WwmService } from './wwm.service.js';

@Module({
  imports: [GameDataModule],
  providers: [WwmService, WwmCommands],
  exports: [WwmService],
})
export class WwmModule {}
