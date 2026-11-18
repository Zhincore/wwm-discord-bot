import { Global, Module } from '@nestjs/common';

import { DatabaseService } from './database/database.service.js';
import { KvStore } from './database/kv-store.service.js';
import { DiscordService } from './discord.service.js';

@Global()
@Module({
  providers: [DatabaseService.forRoot(), KvStore, DiscordService],
  exports: [DatabaseService, KvStore],
})
export class CommonModule {}
