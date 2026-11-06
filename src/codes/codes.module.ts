import { Module } from '@nestjs/common';

import { CodesCommands } from './codes.commands.js';
import { CodesNotifier } from './codes.notifier.js';
import { CodesService } from './codes.service.js';

@Module({
  providers: [CodesService, CodesCommands, CodesNotifier],
})
export class CodesModule {}
