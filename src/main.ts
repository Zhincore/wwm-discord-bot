import.meta.hot.accept();
import fs from 'node:fs';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BunAdapter, NestBunApplication } from 'nestjs-platform-bun';

import { AppModule } from './app.module.js';
import { DATA_DIR } from './consts.js';

async function bootstrap() {
  const logger = new Logger('bootstrap');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const app = await NestFactory.create<NestBunApplication>(
    AppModule,
    new BunAdapter(),
  );
  import.meta.hot.dispose(async () => {
    logger.log('Closing server for hot reload...');
    await app.close().catch(console.error);
  });

  await app.listen(process.env.PORT ?? 3000);
  logger.log(`Listening on ${await app.getUrl()}`);
}
await bootstrap();
