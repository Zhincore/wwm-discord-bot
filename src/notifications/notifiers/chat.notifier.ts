import type { ChatEvent } from '#wwm/proxy/wwm-api.js';

import { BaseNotificationsNotifier, type GuildSetting } from './base';

export class ChatNotifier extends BaseNotificationsNotifier<'chat'> {
  protected override getKind(): 'chat' {
    return 'chat';
  }

  protected override async onEvent(
    event: ChatEvent,
    guilds: GuildSetting[],
  ): Promise<void> {}
}
