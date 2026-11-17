import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';

import {
  WwmEvents,
  type WwmEventListener,
  type WwmEventName,
} from './proxy/wwm-events';
import { WwmProxy } from './proxy/wwm-proxy';
import { LLM_MODEL } from '#consts.ts';
import type { OpenRouter } from '@openrouter/sdk';

const WWM_API = process.env['WWM_API']?.trim() || '';
const WWM_API_TOKEN = process.env['WWM_API_TOKEN']?.trim() || '';

@Injectable()
export class WwmService implements OnApplicationBootstrap, OnModuleDestroy {
  readonly #logger = new Logger(WwmService.name);
  readonly #wwm = new WwmProxy(WWM_API, WWM_API_TOKEN);
  readonly #events = new WwmEvents(WWM_API, WWM_API_TOKEN, this.#logger);

constructor(private readonly llm: OpenRouter) {}

  onApplicationBootstrap() {
    if (WWM_API) this.#events.start();
    else this.#logger.warn('WWM_API not specified, disabled.');this.llm.chat.send({
      chatRequest: {
        model: LLM_MODEL,
        provider: {
          dataCollection: "deny",

      },
    });
  }

  onModuleDestroy() {
    return this.#events.stop();
  }

  /** Subscribe to one game event type; returns the unsubscribe function. */
  on<E extends WwmEventName>(ev: E, listener: WwmEventListener<E>) {
    return this.#events.on(ev, listener);
  }

  /** Call a REST endpoint of the game API. */
  private get fetch(): WwmProxy['fetch'] | undefined {
    if (!WWM_API) return;
    return this.#wwm.fetch.bind(this.#wwm);
  }

  public async fetchPlayer(who: string) {
    return await this.fetch?.('GET /player/{who}', {
      params: { who },
      query: {},
    });
  }

  public async fetchGuild(which: string) {
    return await this.fetch?.('GET /guild/members', {});
  }
}
