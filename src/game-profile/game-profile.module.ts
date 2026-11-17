import { Module } from '@nestjs/common';

import { GameDataModule } from '#game-data/game-data.module.js';

import { GameProfileCommands } from './game-profile.commands.js';
import { GameProfileController } from './game-profile.controller.js';
import { GameProfileService } from './game-profile.service.js';

@Module({
  imports: [GameDataModule],
  providers: [GameProfileService, GameProfileCommands],
  controllers: [GameProfileController],
})
export class GameProfileModule {}
