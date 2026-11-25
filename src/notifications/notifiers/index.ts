import type { WwmEventName } from '#wwm/wwm.service.ts';

import type { BaseNotificationsNotifier } from './base';
import { ChatNotifier } from './chat.notifier';
import { GuildwarMatchNotifier } from './guildwar-match.notifier';
import { GuildwarOpponentNotifier } from './guildwar-opponent.notifier';
import { MemberJoinNotifier } from './member-join.notifier';
import { MemberLeftNotifier } from './member-left.notifier';
import { PlayerAppearedNotifier } from './player-appeared.notifier';
import { PlayerLeftNotifier } from './player-left.notifier';

export const NOTIFIERS = {
  chat: ChatNotifier,
  guild_member_joined: MemberJoinNotifier,
  guild_member_left: MemberLeftNotifier,
  guildwar_opponent: GuildwarOpponentNotifier,
  guildwar_match: GuildwarMatchNotifier,
  player_appeared: PlayerAppearedNotifier,
  player_left: PlayerLeftNotifier,
} satisfies { [E in WwmEventName]?: typeof BaseNotificationsNotifier<E> };

export const NotificationKind = Object.keys(NOTIFIERS);
export type NotificationKind = (typeof NotificationKind)[number];

export default [ChatNotifier, MemberJoinNotifier, MemberLeftNotifier];
