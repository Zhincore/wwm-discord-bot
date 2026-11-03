import { Inject, Injectable, Scope } from '@nestjs/common';
import { INQUIRER } from '@nestjs/core';
import { eq, like, sql } from 'drizzle-orm';

import { DatabaseService } from './database.service.js';
import { appState } from './kv.schema.js';

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

/** Namespaced key-value store. Scoped to requesting class. */
@Injectable({ scope: Scope.TRANSIENT })
export class KvStore<TShape extends Record<string, Json>> {
  readonly namespace: string;
  readonly #get;
  readonly #set;
  readonly #delete;
  readonly #clear;

  constructor(
    @Inject(INQUIRER) private readonly parentClass: object,
    private readonly db: DatabaseService,
  ) {
    this.namespace = parentClass.constructor.name;

    const key = sql.placeholder('key');
    const value = sql.placeholder('value');

    this.#get = db
      .select({ value: appState.value })
      .from(appState)
      .where(eq(appState.key, key))
      .prepare();

    this.#set = db
      .insert(appState)
      .values({ key, value })
      .onConflictDoUpdate({ target: appState.key, set: { value } })
      .prepare();

    this.#delete = db.delete(appState).where(eq(appState.key, key)).prepare();

    this.#clear = db
      .delete(appState)
      .where(like(appState.key, sql.placeholder('pattern')))
      .prepare();
  }

  private fullKey(key: keyof TShape & string) {
    return `${this.namespace}:${key}`;
  }

  get<K extends keyof TShape & string>(key: K): TShape[K] | undefined {
    const row = this.#get.get({ key: this.fullKey(key) });
    return row?.value as TShape[K] | undefined;
  }

  set<K extends keyof TShape & string>(key: K, value: TShape[K]) {
    this.#set.run({ key: this.fullKey(key), value });
  }

  /** Read-modify-write in one transaction. */
  patch<K extends keyof TShape & string>(
    key: K,
    fn: (current: TShape[K] | undefined) => TShape[K],
  ) {
    this.db.transaction(() => {
      this.set(key, fn(this.get(key)));
    });
  }

  delete(key: keyof TShape & string) {
    this.#delete.run({ key: this.fullKey(key) });
  }

  /** Drop every key in this namespace. */
  clear() {
    this.#clear.run({ pattern: `${this.namespace}:%` });
  }
}
