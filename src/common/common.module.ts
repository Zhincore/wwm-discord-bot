import { Global, Module } from '@nestjs/common';

import { DatabaseService } from './database/database.service.js';
import { KvStore } from './database/kv-store.service.js';

@Global()
@Module({
  providers: [DatabaseService.forRoot(), KvStore],
  exports: [DatabaseService, KvStore],
})
export class CommonModule {}
