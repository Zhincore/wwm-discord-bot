import { Injectable, type OnModuleDestroy } from '@nestjs/common';

import type { WwmEventOf } from '#wwm/proxy/wwm-events.ts';
import type { WwmEventName, WwmService } from '#wwm/wwm.service.ts';

import type { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsNotifier implements OnModuleDestroy {
  #unlisten;

  constructor(
    private readonly settings: NotificationsService,
    private readonly wwm: WwmService,
  ) {
    this.#unlisten = wwm.onAny((ev) => this.#onEvent(ev));
  }

  onModuleDestroy() {
    this.#unlisten();
  }

  async #onEvent(event: WwmEventOf<WwmEventName>) {}
}
