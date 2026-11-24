import { Module } from '@nestjs/common';

import { WwmModule } from '#wwm/wwm.module.ts';

import { NotificationsCommands } from './notifications.commands';
import { NotificationsNotifier } from './notifications.notifier';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [
    NotificationsService,
    NotificationsNotifier,
    NotificationsCommands,
  ],
  imports: [WwmModule],
})
export class NotificationsModule {}
