import Path from 'node:path';

import { Injectable, Logger } from '@nestjs/common';
import { ApplicationEmoji, Client } from 'discord.js';
import { eq, sql } from 'drizzle-orm';

import { DatabaseService } from '#common/database/database.service.js';
import { onceReady } from '#common/utils.js';

import { WwmMartialArt } from './game-data.client';
import { GameDataService } from './game-data.service';
import { gameDataEmojis } from './game-emojis.schema';

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

  private async updateData() {
    if (this.updating) return;
    this.updating = true;
    try {
      this.logger.log('Updating game data emojis...');
      await this.rebuildEmojiCache();

      this.logger.log('Updating game data innerway emojis...');
      const innerWays = this.data.list('innerWay');
      const pathPics = innerWays
        .filter((a) => a.liupai_pic_url && a.is_post)
        .map((a) => a.liupai_pic_url);

      for (const picUrl of new Set(pathPics)) {
        await this.ensureEmoji(getURLFilename(picUrl), picUrl);
      }

      this.logger.log('Updating game data martial art emojis...');
      const martialArts = this.data.list('martialArt');

      for (const art of martialArts) {
        if (!art.name) continue;
        await this.ensureEmoji(sluggify(art.name), art.pic_url);
      }

      this.logger.log('Game data emojis updated.');
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
