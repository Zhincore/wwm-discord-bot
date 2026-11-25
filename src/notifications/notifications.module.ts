import { Module } from '@nestjs/common';

import { GameDataModule } from '#game-data/game-data.module.ts';
import { WwmModule } from '#wwm/wwm.module.ts';

import { NotificationsCommands } from './notifications.commands';
import { NotificationsService } from './notifications.service';
import notifiers from './notifiers';

@Module({
  providers: [NotificationsService, NotificationsCommands, ...notifiers],
  imports: [WwmModule, GameDataModule],
})
export class NotificationsModule {}
