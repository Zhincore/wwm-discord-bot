import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';

import type {
  GuildPart,
  GuildParts,
  GuildWarPart,
  GuildWarParts,
  NoGuild,
  PlayerInclude,
} from './proxy/wwm-api';
import {
  WwmEvents,
  type WwmEventListener,
  type WwmEventName as AllWwmEventName,
} from './proxy/wwm-events';
import { WwmProxy } from './proxy/wwm-proxy';

const WWM_API = process.env['WWM_API']?.trim() || '';
const WWM_API_TOKEN = process.env['WWM_API_TOKEN']?.trim() || '';

const EVENTS = [
  'bridge_connected',
  'bridge_disconnected',
  'chat',
  'guild_log',
  'guild_event_soon',
  'guild_event_start',
  'guildwar_opponent',
  'guildwar_match',
  'guild_member_joined',
  'guild_member_left',
] satisfies [AllWwmEventName, ...AllWwmEventName[]];

export type WwmEventName = (typeof EVENTS)[number];

@Injectable()
export class WwmService implements OnApplicationBootstrap, OnModuleDestroy {
  readonly #logger = new Logger(WwmService.name);
  readonly #wwm = new WwmProxy(WWM_API, WWM_API_TOKEN);
  readonly #events = new WwmEvents<WwmEventName>(
    WWM_API,
    WWM_API_TOKEN,
    this.#logger,
    {
      ev: EVENTS,
      channel: ['club_chat'],
    },
  );

  onApplicationBootstrap() {
    if (WWM_API) this.#events.start();
  }

  onModuleDestroy() {
    return this.#events.stop();
  }

  /** Subscribe to one game event type; returns the unsubscribe function. */
  on<E extends WwmEventName>(ev: E, listener: WwmEventListener<E>) {
    return this.#events.on(ev, listener);
  }
  onAny(listener: WwmEventListener<WwmEventName>) {
    return this.#events.onAny(listener);
  }

  /** Call a REST endpoint of the game API. */
  private get fetch(): WwmProxy['fetch'] | undefined {
    if (!WWM_API) return;
    return this.#wwm.fetch.bind(this.#wwm);
  }

  /** Player card; `include` adds the optional groups. */
  public async fetchPlayer(who: string, include: PlayerInclude[] = []) {
    return await this.fetch?.('GET /player/{who}', {
      params: { who },
      query: include.length ? { include: include.join() } : {},
    });
  }

  /** Players around the in-game bot, closest first; `radius` in metres. */
  public async fetchNearby(radius?: number) {
    return await this.fetch?.('GET /nearby', {
      query: radius ? { radius } : {},
    });
  }

  public async fetchPlayerCohort(who: string) {
    return await this.fetch?.('GET /player/{who}/cohort', {
      params: { who },
      query: {},
    });
  }

  public fetchGuild(which?: string) {
    return this.fetchGuildPart('base', which);
  }

  /** One part of our own guild, or of the guild with the numeric ID `which`. */
  public async fetchGuildPart<K extends keyof GuildParts>(
    part: K,
    which?: string,
  ) {
    const response = which
      ? await this.fetch?.('GET /guilds/{guild}/{part}', {
          params: { guild: which, part },
          query: {},
        })
      : await this.fetch?.(`GET /guild/${part as 'base'}`, {});
    return response as GuildPart<K> | NoGuild | undefined;
  }

  /** Guilds whose name contains the whole word `name`, largest first. */
  public async searchGuilds(name: string, limit?: number) {
    const response = await this.fetch?.('GET /guilds', {
      query: limit ? { name, limit } : { name },
    });
    return response?.results;
  }

  /** One part of our own guild's Guild War data. */
  public async fetchGuildWarPart<K extends keyof GuildWarParts>(part: K) {
    const response = await this.fetch?.(
      `GET /guildwar/${part as 'league'}`,
      {},
    );
    return response as GuildWarPart<K> | undefined;
  }
}
