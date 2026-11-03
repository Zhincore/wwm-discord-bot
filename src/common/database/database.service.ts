import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import Path from 'node:path';

import { Provider } from '@nestjs/common';
import { drizzle, SQLiteBunDatabase } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

import { DATA_DIR } from '#consts.js';

export abstract class DatabaseService extends SQLiteBunDatabase {
  static forRoot(): Provider {
    return {
      provide: DatabaseService,
      useFactory: this.create,
    };
  }

  private static create() {
    mkdirSync(DATA_DIR, { recursive: true });

    const db = drizzle({
      client: new Database(Path.join(DATA_DIR, 'db.sqlite')),
    });

    migrate(db, { migrationsFolder: 'drizzle' });

    return db;
  }
}
