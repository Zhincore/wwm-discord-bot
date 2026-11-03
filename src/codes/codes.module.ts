import { Logger, Module } from '@nestjs/common';

import { CodesCommands } from './codes.commands.js';
import { CodesService } from './codes.service.js';

@Module({
  providers: [Logger, CodesService, CodesCommands],
})
export class CodesModule {}
