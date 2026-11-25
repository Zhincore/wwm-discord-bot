import Path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ApplicationEmoji, Client } from 'discord.js';
import { eq, sql } from 'drizzle-orm';
import sharp from 'sharp';

import { DatabaseService } from '#common/database/database.service.js';
import { onceReady } from '#common/utils.js';

import type { WwmMartialArt } from './game-data.client';
import { GameDataService } from './game-data.service';
import { gameDataEmojis } from './game-emojis.schema';

type Size = [w: number, h: number];
type E = ApplicationEmoji;

const EMOJI_PART_SIZES = {} as const satisfies Record<string, Size>;

@Injectable()
export class GameEmojisService {
  private readonly logger = new Logger(GameEmojisService.name);
  private updating = false;

  #emojiMap = new Map<string, ApplicationEmoji>();

  #getEmoji;
  #putEmoji;

  constructor(
    db: DatabaseService,
    private readonly data: GameDataService,
    private readonly client: Client,
  ) {
    const name = sql.placeholder('name');
    const url = sql.placeholder('url');

    this.#getEmoji = db
      .select()
      .from(gameDataEmojis)
      .where(eq(gameDataEmojis.name, name))
      .prepare();

    this.#putEmoji = db
      .insert(gameDataEmojis)
      .values({ name, url })
      .onConflictDoUpdate({ target: gameDataEmojis.name, set: { url } })
      .prepare();

    client.once('clientReady', () => this.updateData());
    data.on('dataUpdated', () => this.updateData());
  }

  private async getManager() {
    const client = await onceReady(this.client);
    return client.application.emojis;
  }

  private async rebuildEmojiCache() {
    const map = new Map<string, ApplicationEmoji>();

    const manager = await this.getManager();
    const emojis = await manager.fetch();

    for (const emoji of emojis.values()) {
      if (map.has(emoji.name)) {
        this.logger.warn(`Duplicate emoji ${emoji.name}`);
      }
      map.set(emoji.name, emoji);
    }

    this.#emojiMap = map;
  }

  /** @remark Query must not be `g` or `y` */
  private findEmojis(query: RegExp): ApplicationEmoji[] {
    return this.#emojiMap
      .entries()
      .filter(([key]) => query.test(key))
      .toArray()
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }

  private async updateData() {
    if (this.updating) return;
    this.updating = true;
    try {
      this.logger.debug('Updating game data emojis...');
      await this.rebuildEmojiCache();

      this.logger.debug('Updating innerway emojis...');
      const innerWays = this.data.list('innerWay');
      const pathPics = innerWays
        .filter((a) => a.liupai_pic_url && a.is_post)
        .map((a) => a.liupai_pic_url);
      for (const picUrl of new Set(pathPics)) {
        await this.ensureEmoji(getURLFilename(picUrl), picUrl);
      }

      this.logger.debug('Updating martial art emojis...');
      const martialArts = this.data.list('martialArt');
      for (const art of martialArts) {
        if (!art.name) continue;
        await this.ensureEmoji(sluggify(art.name), art.pic_url);
      }

      // this.logger.debug('Updating avatar/head emojis...');
      // const avatars = this.data.list('avatar');
      // for (const avatar of avatars) {
      //   if (!avatar.pic_url) continue;
      //   await this.ensureEmojiParts(
      //     'head_' + avatar.id,
      //     avatar.pic_url,
      //     EMOJI_PART_SIZES.head,
      //   );
      // }

      this.logger.debug('Game data emojis updated.');
    } finally {
      this.updating = false;
    }
  }

  public getPathEmoji(liuPicUrl: string | { liupai_pic_url?: string }) {
    const url =
      typeof liuPicUrl === 'string' ? liuPicUrl : liuPicUrl.liupai_pic_url;
    if (!url) return;
    return this.#emojiMap.get(getURLFilename(url));
  }

  public getMartialArtEmoji(art: WwmMartialArt) {
    if (!art.name) return;
    return this.#emojiMap.get(sluggify(art.name));
  }

  private async ensureEmojiParts(
    name: string,
    url: string,
    grid: [w: number, h: number],
  ) {
    const manager = await this.getManager();
    let emojis = this.findEmojis(new RegExp(name + '_\\d+'));

    if (emojis.length) {
      const record = this.#getEmoji.get({ name });
      // URL mismatch
      if (record?.url !== url) {
        await Promise.all(emojis.map((e) => e.delete()));
        emojis.length = 0;
      }
    }

    if (!emojis.length) {
      this.logger.log(`Updating ${name} emoji parts...`);
      const promises: Promise<unknown>[] = [];
      let i = 0;

      for await (const part of cutUpEmoji(url, grid)) {
        await manager
          .create({ name: name + '_' + i, attachment: part })
          .then((emoji) => this.#emojiMap.set(name, emoji));
        i++;
      }

      await Promise.all(promises);
      this.#putEmoji.run({ name, url });
    }
  }

  private async ensureEmoji(name: string, url: string) {
    const manager = await this.getManager();
    let emoji = this.#emojiMap.get(name);

    if (emoji) {
      const record = this.#getEmoji.get({ name });
      // URL mismatch
      if (record?.url !== url) {
        await emoji.delete();
        emoji = undefined;
      }
    }

    if (!emoji) {
      this.logger.log(`Updating ${name} emoji...`);
      emoji = await manager.create({ name, attachment: url });
      this.#emojiMap.set(name, emoji);
      this.#putEmoji.run({ name, url });
    }
  }
}

function getURLFilename(picUrl: string) {
  const url = new URL(picUrl);
  const filename = Path.basename(url.pathname, Path.extname(url.pathname));
  return filename.substring(0, 32);
}

const sluggify = (str: string) =>
  str
    .toLowerCase()
    .replaceAll(/[^\w]+/g, '_')
    .replaceAll(/(^_)|(_$)/g, '');

async function* cutUpEmoji(url: string, grid: Size) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error('Failed to fetch emoji: ' + response.statusText);

  const {
    data: image,
    info,
    cellSize,
  } = await (async () => {
    const image = sharp(await response.arrayBuffer());
    const metadata = await image.metadata();

    const cellWidth = Math.ceil(metadata.width / grid[0]);
    const cellHeight = Math.ceil(metadata.height / grid[1]);
    const cellSize = Math.max(cellWidth, cellHeight);

    const { data, info } = await image
      .resize({
        fit: 'contain',
        width: cellSize * grid[0],
        height: cellSize * grid[1],
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .raw()
      .toBuffer({ resolveWithObject: true });
    return { data, info, cellSize };
  })();

  for (let y = 0; y < grid[1]; y++) {
    for (let x = 0; x < grid[0]; x++) {
      yield sharp(image, { raw: info })
        .extract({
          width: cellSize,
          height: cellSize,
          left: x * cellSize,
          top: y * cellSize,
        })
        .webp()
        .toBuffer();
    }
  }
}
