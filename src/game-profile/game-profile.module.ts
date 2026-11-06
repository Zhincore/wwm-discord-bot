import { Module } from '@nestjs/common';

import { WwmModule } from '#wwm/wwm.module.js';

import { GameProfileCommands } from './game-profile.commands.js';
import { GameProfileController } from './game-profile.controller.js';
import { GameProfileService } from './game-profile.service.js';

@Module({
  imports: [WwmModule],
  providers: [GameProfileService, GameProfileCommands],
  controllers: [GameProfileController],
})
export class GameProfileModule {}
