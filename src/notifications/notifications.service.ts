import { Injectable } from '@nestjs/common';
import type { Snowflake } from 'discord.js';
import { and, eq, sql } from 'drizzle-orm';

import { DatabaseService } from '#common/database/database.service.ts';
import type { WwmEventName } from '#wwm/wwm.service.ts';

import { notificationsTable } from './notifications.schema';
import type { NotificationKind } from './notifiers';
import type { BaseNotificationsNotifier } from './notifiers/base';

@Injectable()
export class NotificationsService {
  #notifiers: { [E in WwmEventName]?: BaseNotificationsNotifier<E> } = {};

  #iterateGuilds;
  #getGuild;
  #enableNotifications;
  #disableNotifications;

  constructor(db: DatabaseService) {
    const guildId = sql.placeholder('guildId');
    const kind = sql.placeholder('kind');
    const channel = sql.placeholder('channel');
    const role = sql.placeholder('role');

    this.#iterateGuilds = db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.kind, kind))
      .prepare();
    this.#getGuild = db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.guildId, guildId))
      .prepare();
    this.#enableNotifications = db
      .insert(notificationsTable)
      .values({ guildId, kind, channel, pingRole: role })
      .onConflictDoUpdate({
        target: [notificationsTable.guildId, notificationsTable.kind],
        set: { channel, pingRole: role },
      })
      .prepare();
    this.#disableNotifications = db
      .delete(notificationsTable)
      .where(
        and(
          eq(notificationsTable.guildId, guildId),
          eq(notificationsTable.kind, kind),
        ),
      )
      .prepare();
  }

  public register<K extends WwmEventName>(
    kind: K,
    notifier: BaseNotificationsNotifier<K>,
  ) {
    Object.assign(this.#notifiers, { [kind]: notifier });
  }
  public getNotifier<K extends NotificationKind>(
    kind: K,
  ): BaseNotificationsNotifier<K> | undefined {
    return this.#notifiers[kind];
  }

  public getGuilds(kind: WwmEventName) {
    return this.#iterateGuilds.all({ kind });
  }

  public getGuildSettings(guildId: Snowflake) {
    return this.#getGuild.get({ guildId });
  }

  public enableNotifications(
    guildId: Snowflake,
    kind: NotificationKind,
    channel: Snowflake,
    role?: Snowflake,
  ) {
    return !!this.#enableNotifications.run({
      guildId,
      kind,
      channel,
      role,
    }).lastInsertRowid;
  }

  public disableNotifications(guildId: Snowflake, kind: NotificationKind) {
    return !!this.#disableNotifications.run({ guildId, kind }).changes;
  }
}
