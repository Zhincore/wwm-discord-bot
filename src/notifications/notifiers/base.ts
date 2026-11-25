import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import {
  ChannelManager,
  ChannelType,
  Role,
  TextChannel,
  type InteractionReplyOptions,
  type MessageCreateOptions,
} from 'discord.js';
import type { SlashCommandContext } from 'necord';

import type { notificationsTable } from '#notifications/notifications.schema.ts';
import type { WwmEventOf } from '#wwm/proxy/wwm-events.ts';
import { type WwmEventName, WwmService } from '#wwm/wwm.service.ts';

import { NotificationsService } from '../notifications.service';

export type GuildSetting = Omit<
  typeof notificationsTable.$inferSelect,
  'channel' | 'pingRole'
> & { channel: TextChannel; pingRole?: Role };

export type WwmEvent<E extends WwmEventName> =
  WwmEventOf<E> extends { seq: number } & (infer T) ? T : never;

@Injectable()
export abstract class BaseNotificationsNotifier<
  E extends WwmEventName,
> implements OnModuleDestroy {
  #unlisten;

  public abstract getKind(): E;

  constructor(
    private readonly settings: NotificationsService,
    private readonly channels: ChannelManager,
    wwm: WwmService,
  ) {
    const kind = this.getKind();
    this.settings.register(kind, this);
    this.#unlisten = wwm.on(kind, (ev) => this.#onEvent(ev));
  }

  onModuleDestroy() {
    this.#unlisten();
  }

  async #onEvent(event: WwmEventOf<E>) {
    if (!('ev' in event)) return;

    const guilds = this.settings.getGuilds(event.ev);
    if (!guilds.length) return;

    const fetchedGuilds = await Promise.all(
      guilds
        .map(async (g) => {
          const channel = await this.channels.fetch(g.channel);
          if (channel?.type !== ChannelType.GuildText) return;

          const pingRole =
            g.pingRole && (await channel.guild.roles.fetch(g.pingRole));

          return { ...g, channel, pingRole };
        })
        .filter((v) => v),
    );

    this.onEvent(event as WwmEvent<E>, fetchedGuilds as GuildSetting[]);
  }

  protected abstract onEvent(
    event: WwmEvent<E>,
    guilds: GuildSetting[],
  ): Promise<void>;

  public async previewEvent([_interaction]: SlashCommandContext): Promise<
    undefined | MessageCreateOptions | InteractionReplyOptions
  > {
    return {
      flags: ['Ephemeral'],
      content: "This notification kind doesn't support previews, sorry.",
    };
  }
}
