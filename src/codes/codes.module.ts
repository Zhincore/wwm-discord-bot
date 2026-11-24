import { Module } from '@nestjs/common';

import { CodesCommands } from './codes.commands.js';
import { CodesService } from './codes.service.js';

@Module({
  providers: [CodesService, CodesCommands],
  exports: [CodesService],
})
export class CodesModule {}
