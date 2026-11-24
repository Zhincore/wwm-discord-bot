import { Injectable, type OnModuleDestroy } from '@nestjs/common';

import type { notificationsTable } from '#notifications/notifications.schema.ts';
import type { WwmEventOf } from '#wwm/proxy/wwm-events.ts';
import type { WwmEventName, WwmService } from '#wwm/wwm.service.ts';

import type {
  NotificationKind,
  NotificationsService,
} from '../notifications.service';

export type GuildSetting = typeof notificationsTable.$inferSelect & {};
type WwmEvent<E extends WwmEventName> =
  WwmEventOf<E> extends { seq: number } & (infer T) ? T : never;

@Injectable()
export abstract class BaseNotificationsNotifier<
  E extends WwmEventName,
> implements OnModuleDestroy {
  #unlisten;

  protected abstract getKind(): E;

  constructor(
    private readonly settings: NotificationsService,
    wwm: WwmService,
  ) {
    this.#unlisten = wwm.on(this.getKind(), (ev) => this.#onEvent(ev));
  }

  onModuleDestroy() {
    this.#unlisten();
  }

  async #onEvent(event: WwmEventOf<E>) {
    if (!('ev' in event)) return;

    const guilds = this.settings.getGuilds(event.ev as NotificationKind);
    if (guilds.length) this.onEvent(event as WwmEvent<E>, guilds);
  }

  protected abstract onEvent(
    event: WwmEvent<E>,
    guilds: GuildSetting[],
  ): Promise<void>;
}
