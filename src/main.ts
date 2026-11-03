import fs from 'node:fs';

import { NestFactory } from '@nestjs/core';
import { BunAdapter, NestBunApplication } from 'nestjs-platform-bun';

import { AppModule } from './app.module.js';
import { DATA_DIR } from './consts.js';

async function bootstrap() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const app = await NestFactory.create<NestBunApplication>(
    AppModule,
    new BunAdapter(),
  );
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
