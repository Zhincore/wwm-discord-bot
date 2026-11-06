import { Module } from '@nestjs/common';

import { GameDataService } from './game-data.service';
import { GameEmojisService } from './game-emojis.service';

@Module({
  providers: [GameDataService, GameEmojisService],
  exports: [GameDataService, GameEmojisService],
})
export class WwmModule {}
