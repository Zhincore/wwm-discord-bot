import { Logger, Module } from '@nestjs/common';

import { CodesCommands } from './codes.commands.js';
import { CodesNotifier } from './codes.notifier.js';
import { CodesService } from './codes.service.js';

@Module({
  providers: [Logger, CodesService, CodesCommands, CodesNotifier],
})
export class CodesModule {}
