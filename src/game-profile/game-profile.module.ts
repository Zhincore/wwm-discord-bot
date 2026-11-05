import { Module } from '@nestjs/common';

import { GameProfileCommands } from './game-profile.commands.js';
import { GameProfileController } from './game-profile.controller.js';
import { GameProfileService } from './game-profile.service.js';

@Module({
  providers: [GameProfileService, GameProfileCommands],
  controllers: [GameProfileController],
})
export class GameProfileModule {}
