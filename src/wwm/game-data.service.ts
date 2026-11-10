import EventEmitter from 'node:events';

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';

import { DatabaseService } from '#common/database/database.service.js';

import {
  fetchGameData,
  WWM_DATA_KINDS,
  WwmDataKindTypes,
  WwmEleganceLevel,
} from './game-data.client';
import { gameData } from './game-data.schema';
import { fetchAffixNames } from './where-builds-meet.client';

type DataKinds = WwmDataKindTypes & { affix: { id: number; name: string } };
type DataKind = keyof DataKinds;

interface GameDataServiceEvents {
  dataUpdated: [];
}

@Injectable()
export class GameDataService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GameDataService.name);
  readonly #events = new EventEmitter<GameDataServiceEvents>();

  #getItem;
  #getItems;
  #listItems;
  #getElegance;

  constructor(private readonly db: DatabaseService) {
    const kind = sql.placeholder('kind');
    const id = sql.placeholder('id');
    const elegance = sql.placeholder('elegance');

    this.#getItem = db
      .select({ data: gameData.data })
      .from(gameData)
      .where(and(eq(gameData.kind, kind), eq(gameData.id, id)))
      .prepare();
    this.#getItems = db
      .select()
      .from(gameData)
      .where(
        and(
          eq(gameData.kind, kind),
          inArray(gameData.id, sql`(SELECT value from json_each(${id}))`),
        ),
      )
      .prepare();

    this.#listItems = db
      .select({ data: gameData.data })
      .from(gameData)
      .where(eq(gameData.kind, kind))
      .prepare();

    this.#getElegance = db
      .select({ data: gameData.data })
      .from(gameData)
      .where(lte(sql`${gameData.data} ->> "$.score"`, elegance))
      .orderBy(desc(gameData.id))
      .limit(1)
      .prepare();
  }

  public readonly on = this.#events.on.bind(this.#events);
  public readonly once = this.#events.once.bind(this.#events);
  public readonly off = this.#events.off.bind(this.#events);

  async onApplicationBootstrap() {
    if (this.db.$count(gameData).sync() === 0) await this.refresh();
  }

  private updateDataKind<K extends DataKind>(kind: K, rows: DataKinds[K][]) {
    return this.db.transaction((tx) => {
      tx.delete(gameData).where(eq(gameData.kind, kind)).run();
      tx.insert(gameData)
        .values(
          rows.map((r) => ({
            kind,
            id: r.id,
            name: 'name' in r ? r.name : undefined,
            data: r,
          })),
        )
        .run();
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async refresh() {
    this.logger.debug('Refetching game data...');

    for (const kind of WWM_DATA_KINDS) {
      this.logger.debug(`Fetching ${kind} data`);
      const data = await fetchGameData(kind);
      const rows = Array.isArray(data) ? data : Object.values(data);

      this.updateDataKind(kind, rows);
    }

    this.logger.debug(`Fetching affix data`);
    const affixes = await fetchAffixNames();
    this.updateDataKind('affix', affixes);

    this.logger.debug('Refetching done.');
    this.#events.emit('dataUpdated');
  }

  list<K extends DataKind>(kind: K) {
    return this.#listItems
      .all({ kind })
      .map(({ data }) => data as DataKinds[K]);
  }

  get<K extends DataKind>(kind: K, id: number) {
    const result = this.#getItem.get({ kind, id });
    if (!result) return;

    return result.data as DataKinds[K];
  }
  getMultiple<K extends DataKind, Ids extends number[] | []>(
    kind: K,
    ids: Ids,
  ) {
    const items = new Map(
      this.#getItems
        .all({ kind, id: JSON.stringify(ids) })
        .map(({ id, data }) => [id, data as DataKinds[K]]),
    );

    return ids.map((id) => items.get(id)) as {
      -readonly [Id in keyof Ids]: DataKinds[K] | undefined;
    };
  }

  getElegance(score: number) {
    const result = this.#getElegance.get({ elegance: score });
    return result!.data as WwmEleganceLevel;
  }
}
