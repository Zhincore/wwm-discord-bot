/**
 * Type definitions for the dockerized-wwm HTTP API (default http://localhost:8000):
 * request/response calls plus one server-sent event stream (`GET /events`).
 *
 * Conventions
 * - All timestamps are Unix seconds (some carry fractions). Players carry two ids: `uid`, the numeric
 *   player ID shown in game, and `pid`, the game's internal id (16 chars, may contain `/` and `+` ->
 *   URL-encode in paths). `uid` is absent for a moment when a player was only just seen (it is
 *   resolved in the background); guild members always have it. `hostnum` is the player's home server.
 * - Fields the game did not provide are ABSENT (never null) - hence the many optional members.
 * - `GameData` marks data passed through from the game unchanged (ids are numeric; shape may change
 *   with game updates).
 * - Errors: FastAPI style `{ "detail": string }` with 401 (token), 403 (dev-only route), 404 (unknown part / player not
 *   found), 409 (no snapshot yet), 503 (game not connected), 504 (game did not answer in time).
 * - Auth: when the server has WWM_API_TOKEN set, send `Authorization: Bearer <token>` on every
 *   request, including the event stream.
 */

/** Internal player id. Stable, but not shown to players - prefer `Uid` for anything user-facing. */
export type Pid = string;
/** Numeric player ID as shown in game ("number_id"), as a string. Usable with `GET /player/{uid}`. */
export type Uid = string;
export type Timestamp = number;
export type GameData = unknown;
export interface ApiError { detail: string }

// ---------------------------------------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------------------------------------

export interface Endpoints {
  "GET /status": { response: Status };
  "GET /window": { response: WindowInfo[] };
  /** PNG image. `region` = "x,y,w,h"; `scale` in (0, 1]. */
  "GET /screenshot.png": { query: { region?: string; scale?: number }; /** PNG bytes */ response: ArrayBuffer };
  "POST /click": { body: ClickRequest; response: Ok };
  "POST /move": { body: { x: number; y: number }; response: Ok };
  /** `keys`: xdotool keysyms, space separated (e.g. "Escape", "ctrl+a"). */
  "POST /key": { body: { keys: string; delay_ms?: number }; response: Ok };
  "POST /type": { body: { text: string; delay_ms?: number }; response: Ok };
  "POST /scroll": { body: { x: number; y: number; clicks?: number }; response: Ok };

  /** Run a command of the in-game Lua loader. `timeout: 0` returns `{ id }` without waiting. */
  /**
   * DEV ONLY (server started with WWM_DEV=1; 403 otherwise): run any command of the game scripts.
   * For a specific request `R` the response is `CommandResultOf<R>` (or `{ id }` with `timeout: 0`).
   * Production code uses the purpose-named routes below instead.
   */
  "POST /cmd": { body: CommandRequest; response: AnyCommandResult | { id: number } };
  /**
   * Server-sent event stream (`text/event-stream`). Every message has `id` = the event's `seq` and
   * `data` = one `BridgeEvent` as JSON; comment lines (`: keep-alive`) arrive every 10 s when idle.
   * - replay: `since=<seq>`, or the `Last-Event-ID` header on reconnect, first sends buffered events
   *   after that number (the 500 newest per event name are kept)
   * - filter: any other query parameter restricts on an event field with a comma-separated list of
   *   accepted values, e.g. `/events?ev=chat&channel=world,club_chat`
   * Command results are never sent on the stream.
   */
  "GET /events": { query: { since?: number } & Record<string, string | number>; /** one per SSE message */ response: BridgeEvent };

  "GET /guild": { response: GuildSnapshot | NoGuild };
  "GET /guild/base": { response: GuildPart<"base"> | NoGuild };
  "GET /guild/members": { response: GuildPart<"members"> | NoGuild };
  "GET /guild/events": { response: GuildPart<"events"> | NoGuild };
  "GET /guild/log": { response: GuildPart<"log"> | NoGuild };

  /** Poll the guild now instead of waiting for the next 60 s tick; changes arrive on the event stream. */
  "POST /guild/refresh": { response: RefreshStatus };
  /** Check Guild War data now; changes arrive on the event stream. */
  "POST /guildwar/refresh": { response: RefreshStatus };

  "GET /guildwar": { response: GuildWarSnapshot };
  "GET /guildwar/league": { response: GuildWarPart<"league"> };
  "GET /guildwar/matchmaking": { response: GuildWarPart<"matchmaking"> };
  "GET /guildwar/matches": { response: GuildWarPart<"matches"> };
  "GET /guildwar/signups": { response: GuildWarPart<"signups"> };

  /**
   * `who`: exact player name, numeric player ID (`number_id`), or a Pid. A bare Pid of a player
   * outside the bot's guild also needs `hostnum`. Cached 5 minutes unless `refresh`.
   * `sections`: comma-separated extra raw profile sections, returned under `sections`.
   */
  "GET /player/{who}": {
    query: { hostnum?: number; sections?: string; refresh?: boolean };
    response: PlayerProfile;
  };
}

export interface Ok { ok: true }

/** `status`: what the script did, e.g. "polling", "busy", "ok", "no guild", "not in world". */
export interface RefreshStatus { status?: string }

export interface Status {
  uptime_s: number;
  game_running: boolean;
  renderer: string | null;
  display: string | null;
  /** "<width> <height>" */
  screen: string;
  /** true while the in-game Lua loader is connected */
  bridge: boolean;
}

export interface WindowInfo {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  screen: number;
}

export interface ClickRequest {
  x: number;
  y: number;
  /** 1 = left (default), 2 = middle, 3 = right */
  button?: number;
  double?: boolean;
  hold_ms?: number;
}

// ---------------------------------------------------------------------------------------------
// Commands (POST /cmd, dev only)
// ---------------------------------------------------------------------------------------------

export type CommandRequest =
  | { cmd: "ping"; args?: {}; timeout?: number }
  | { cmd: "eval"; args: { code: string }; timeout?: number }
  | { cmd: "perf"; args: { fps?: number; ui_only?: boolean }; timeout?: number }
  | { cmd: "quit"; args?: {}; timeout?: number }
  | { cmd: "guild"; args?: { part?: "all" | keyof GuildParts }; timeout?: number }
  | { cmd: "guild_refresh"; args?: {}; timeout?: number }
  | { cmd: "guildwar"; args?: { part?: "all" | keyof GuildWarParts }; timeout?: number }
  | { cmd: "guildwar_refresh"; args?: {}; timeout?: number }
  | { cmd: "player"; args: { who: string; hostnum?: number; sections?: string[]; refresh?: boolean }; timeout?: number };

/** Name of every command. */
export type CommandName = CommandRequest["cmd"];

/**
 * `data` of a successful result for a given request. Follows `args.part` for `guild` / `guildwar`:
 * `CommandData<{ cmd: "guild"; args: { part: "members" } }>` is `GuildPart<"members"> | NoGuild`.
 */
export type CommandData<R extends { cmd: CommandName; args?: unknown }> =
  R extends { cmd: "ping" } ? "pong"
  : R extends { cmd: "eval" } ? unknown
  : R extends { cmd: "perf" } ? { fps: number; ui_only: boolean }
  : R extends { cmd: "quit" } ? { logout: boolean }
  : R extends { cmd: "guild_refresh" | "guildwar_refresh" } ? string
  : R extends { cmd: "player" } ? PlayerProfile
  : R extends { cmd: "guild" } ? (
      R extends { args: { part: infer P } }
        ? (P extends keyof GuildParts ? GuildPart<P> : GuildSnapshot) | NoGuild
        : GuildSnapshot | NoGuild)
  : R extends { cmd: "guildwar" } ? (
      R extends { args: { part: infer P } }
        ? (P extends keyof GuildWarParts ? GuildWarPart<P> : GuildWarSnapshot)
        : GuildWarSnapshot)
  : unknown;

/** Result message of a command: `ok: true` carries `data`, `ok: false` carries `error`. */
export type CommandResult<T = unknown, C extends string = string> =
  | { ev: "result"; id: number; cmd: C; ok: true; data: T }
  | { ev: "result"; id: number; cmd: C; ok: false; error: string };

/** Result of one specific `POST /cmd` request, e.g. `CommandResultOf<{ cmd: "player"; args: { who: string } }>`. */
export type CommandResultOf<R extends { cmd: CommandName; args?: unknown }> = CommandResult<CommandData<R>, R["cmd"]>;

/** Any command result, discriminated by `cmd` (then by `ok`): narrowing on `cmd` types `data`. */
export type AnyCommandResult = { [C in CommandName]: CommandResult<CommandData<{ cmd: C }>, C> }[CommandName];

// ---------------------------------------------------------------------------------------------
// Guild
// ---------------------------------------------------------------------------------------------

/** The bot's character is not in a guild. */
export interface NoGuild { club: false }

export interface GuildParts {
  base: GuildBase;
  /** keyed by Uid (numeric player ID) */
  members: Record<Uid, GuildMember>;
  /** keyed by play type id as string ("13", "17", "2", ...) */
  events: Record<string, GuildPlay>;
  /** newest first, at most 200 */
  log: GuildLogEntry[];
}

export interface GuildSnapshot extends GuildParts {
  /** time of the last in-game poll (every 60 s) */
  updated: Timestamp;
  club_id: string;
}

export type GuildPart<K extends keyof GuildParts> = { updated: Timestamp; club_id: string } & Pick<GuildParts, K>;

export interface GuildBase {
  name?: string;
  /** public numeric guild ID */
  number_id?: number;
  level?: number;
  exp?: number;
  fund?: number;
  total_fund?: number;
  daily_fund?: number;
  liveness?: number;
  fame?: number;
  week_fame?: number;
  /** guild announcement text (game markup) */
  notice?: string;
  /** recruitment text (game markup) */
  purpose?: string;
  create_ts?: Timestamp;
  member_count: number;
  online_count: number;
}

export interface GuildMember {
  pid: Pid;
  uid: Uid;
  name?: string;
  level?: number;
  /** localized rank names, sorted; includes custom ranks */
  roles: string[];
  join_ts?: Timestamp;
  online: boolean;
  login_ts?: Timestamp;
  logout_ts?: Timestamp;
  /** contribution, total and this week */
  fund?: number;
  week_fund?: number;
  liveness?: number;
  total_liveness?: number;
}

export interface GuildPlay {
  /** play type id: 13 Breaking Army, 17 Showdown, 2 Guild Party, ... */
  type: number;
  /** localized name */
  name?: string;
  state?: number;
  start_ts?: Timestamp;
  /** [hour, minute] in server time (UTC+8); only some plays */
  open_time: number[];
  schedule: GuildPlaySlot[];
  next_week_schedule: GuildPlaySlot[];
}

export interface GuildPlaySlot {
  /** 1 = Monday ... 7 = Sunday, server time (UTC+8) */
  weekday?: number;
  /** [hour, minute], server time (UTC+8) */
  start_time: number[];
  /** absolute start/end computed by the game's calendar */
  start_ts?: Timestamp;
  end_ts?: Timestamp;
  boss_id?: number;
  /** boss name, or the numeric id when the name is unknown */
  boss?: string | number;
  arena_type?: number;
}

/** Every guild log entry type the game defines (event_id 1-27, in this order). */
export type GuildLogKind =
  | "member_joined" | "member_left" | "member_kicked" | "member_approved" | "member_invited"
  | "rank_appointed" | "rank_removed" | "leader_transferred" | "leader_auto_transferred"
  | "guild_level_up" | "building_level_up" | "low_funds_warning"
  | "party_autostart_on" | "showdown_rescheduled" | "breaking_army_rescheduled"
  | "party_autostart_off" | "party_autostart_off_maintenance"
  | "showdown_rescheduled_maintenance" | "breaking_army_rescheduled_maintenance"
  | "league_qualified" | "league_placement" | "league_round_end" | "league_season_end"
  | "layout_applied" | "layout_cleared" | "skyward_bond_record" | "competition_first_place";

export interface GuildLogEntry {
  /** log category: 1 Members, 2 Promotion, 3 Construction, 4 Events, 5 Guild War, 6 Fun Competition */
  type: number;
  event_id: number;
  /** absent only for an event id newer than this list */
  kind?: GuildLogKind;
  /** players named in the entry, in the order of the text: the actor first, then the target */
  players: PlayerRef[];
  ts: Timestamp;
  /** raw parameters: player ids followed by their hostnum, names, numbers, [weekday, h, m] arrays */
  params: unknown[];
  /** category label, e.g. "[Members]" */
  title: string;
  /** rendered like the in-game log; times inside are server time (UTC+8) */
  text: string;
}

// ---------------------------------------------------------------------------------------------
// Guild War
// ---------------------------------------------------------------------------------------------

export interface GuildWarParts {
  league: GuildWarLeague;
  matchmaking: GuildWarMatchmaking;
  /** newest first; only matches the game still lists as recent */
  matches: GuildWarMatch[];
  /** keyed by league day number as string */
  signups: Record<string, GuildWarSignupDay>;
}

export interface GuildWarSnapshot extends GuildWarParts {
  updated: Timestamp;
  club_id: string;
}

export type GuildWarPart<K extends keyof GuildWarParts> = { updated: Timestamp; club_id: string } & Pick<GuildWarParts, K>;

export interface GuildWarLeague {
  season?: number;
  rank?: number;
  fame?: number;
  win_count?: number;
  small_score?: number;
  group?: number;
  signup_ts?: Timestamp;
  last_settle_ts?: Timestamp;
  /** absent while no opponent is assigned */
  opponent?: GuildWarOpponent;
}

export interface GuildWarOpponent {
  club_id: string;
  hostnum?: number;
  /** filled once the opponent guild's info has been fetched (within seconds) */
  name?: string;
  level?: number;
  fame?: number;
  rank?: number;
  win_count?: number;
  small_score?: number;
}

export interface GuildWarMatchmaking {
  season?: number;
  round?: number;
  win_count?: number;
  lose_count?: number;
  round_win_count?: number;
  round_loss_count?: number;
  battle_score?: number;
  people?: number;
  match_found_ts?: Timestamp;
}

export type GuildWarMode = "matchmaking" | "league" | "invite" | number;

export interface GuildWarMatch {
  /** unique match id */
  space_id: string;
  /** settle time */
  ts: Timestamp;
  start_ts?: Timestamp;
  season?: number;
  round?: number;
  mode: GuildWarMode;
  win: boolean;
  /** our score before / after the match */
  score: { old?: number; new?: number };
  enemy: {
    club_id?: string;
    hostnum?: number;
    name?: string;
    level?: number;
    score_old?: number;
    score_new?: number;
  };
  /** our roster, sorted by damage. All-zero stats = on the roster but idle. */
  players: GuildWarPlayer[];
  /** empty when the enemy did not show up (walkover) */
  enemy_players: GuildWarPlayer[];
}

export interface GuildWarPlayer {
  pid: Pid;
  uid?: Uid;
  hostnum?: number;
  name?: string;
  kills: number;
  deaths: number;
  assists: number;
  total_damage: number;
  damage_taken: number;
  damage_wall: number;
  healing_done: number;
  /** resources collected */
  baiye_token: number;
  /** the game's MVP score: weighted sum of the stats above (absent if the weights are unavailable) */
  mvp_score?: number;
  /** highest scorer of this player's side (absent on everyone when nobody scored, e.g. a walkover) */
  team_mvp?: true;
  /** the match MVP as the game picks it: highest scorer of the winning side */
  mvp?: true;
}

export interface GuildWarSignupDay {
  applicants: { pid: Pid; uid?: Uid; name?: string; account?: string; apply_ts?: Timestamp }[];
  teams: { index: number; name?: string; members: { pid: Pid; uid?: Uid; name?: string; slot: number }[] }[];
}

// ---------------------------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------------------------

export interface PlayerRef { pid: Pid; uid?: Uid; name?: string }

export interface PlayerProfile {
  fetched: Timestamp;
  pid: Pid;
  hostnum: number;
  name?: string;
  uid?: Uid;
  /** same as `uid` (kept for compatibility) */
  number_id?: string;
  level?: number;
  school?: number;
  vip_level?: number;
  region?: string;
  language?: string;
  created_ts?: Timestamp;
  /** channel the account was created on, e.g. "h72naxx2gb@steam" */
  platform?: string;
  /** device of the last session, e.g. "windows", "android" */
  device?: string;
  online: boolean;
  login_ts?: Timestamp;
  logout_ts?: Timestamp;
  /** total seconds online */
  online_time?: number;
  /** only accounts the player linked; empty strings when not linked */
  linked: { steam?: string; discord_id?: string; discord_name?: string; xbox?: string };
  card: { sign?: string; bg?: number };
  /** avatar: head id, back colour, frames, transform */
  head?: GameData;
  guild: { club_id?: string; fund?: number; week_fund?: number; liveness?: number; total_liveness?: number };
  /** Guild War join counters for `season` */
  guildwar: { season?: number; matchmaking_joins?: number; league_joins?: number; invite_joins?: number };
  /** 1v1 arena */
  pvp: { grade?: number; small_grade?: number; matches?: number; best_streak?: number };
  sworn: { id?: string; name?: string; members: PlayerRef[] };
  mentor: { master?: Pid; students: PlayerRef[] };
  dorm_id?: string;
  /** the player's in-game "hide build" setting; `build` / `equips` are returned regardless */
  build_hidden: boolean;
  /** martial arts (kongfu), inner ways (xinfa), mystic skills (battle_qs), slot -> equip id, ... */
  build?: GameData;
  /** slot -> { ID, No (item number), index, ex (affixes) } */
  equips?: GameData;
  /** present when `sections` was requested: section name -> raw data */
  sections?: Record<string, GameData>;
}

// ---------------------------------------------------------------------------------------------
// Events (GET /events, server-sent events)
// ---------------------------------------------------------------------------------------------

/** One message of the `GET /events` stream. */
export type BridgeEvent = { seq: number } & BridgeEventBody;

export type BridgeEventBody =
  | { ev: "bridge_connected" | "bridge_disconnected" | "hello" | "login_ui" | "enter_game" }
  | { ev: "bad_line"; raw: string }
  | { ev: "handler_error"; for: string; error: string }
  /** Lua asked for an OS-level click; with `window` the coordinates are relative to that X window */
  | { ev: "os_click"; x: number; y: number; window?: string }
  | { ev: "os_clicked"; x: number; y: number; window?: string }
  | { ev: "os_click_skipped"; window: string }
  | { ev: "autologin"; phase: "authed" }
  | { ev: "autologin"; phase: "confirm"; tag: string }
  | { ev: "autologin"; phase: "failed"; reason: string }
  | { ev: "perf"; ui_only: boolean; fps: number }
  | ChatEvent
  | GuildEvent
  | GuildWarEvent;

export interface ChatEvent {
  ev: "chat";
  ts: Timestamp;
  /** channel code: "world", "club_chat" (guild), "near", "team", "private_chat", "system", ... */
  channel?: string;
  /** friendly channel name when known, else the code */
  channel_name?: string;
  sender_id?: Pid;
  /** absent on a sender's first message(s) until resolved in the background */
  sender_uid?: Uid;
  sender_hostnum?: number;
  sender_name?: string;
  sender_level?: number;
  /** avatar (portrait) id */
  head_id?: number;
  /** avatar details: head, back_color, frames, head_transform, ... */
  head_data?: GameData;
  body_type?: number;
  msg_id?: string;
  /** raw text with game markup */
  text?: string;
  /** markup stripped; present only when it differs from `text` */
  text_plain?: string;
  /** e.g. "msg_normal", "msg_system", "msg_artwork_card"; absent for plain messages */
  msg_type?: string;
}

export type GuildEvent =
  | { ev: "guild_updated"; updated: Timestamp; name?: string; first: boolean; member_count: number; online_count: number; fund?: number }
  | { ev: "guild_updated"; club: false }
  | { ev: "guild_member_joined"; pid: Pid; uid?: Uid; name?: string; level?: number; roles: string[] }
  | { ev: "guild_member_left"; pid: Pid; uid?: Uid; name?: string }
  | { ev: "guild_member_roles"; pid: Pid; uid?: Uid; name?: string; from: string[]; to: string[] }
  | { ev: "guild_member_online"; pid: Pid; uid?: Uid; name?: string; online: boolean }
  | { ev: "guild_funds"; fund?: number; delta: number; total_fund?: number }
  | { ev: "guild_level"; from?: number; to?: number }
  /** `notice` absent = announcement cleared */
  | { ev: "guild_notice"; notice?: string }
  | ({ ev: "guild_log" } & GuildLogEntry)
  | { ev: "guild_play_state"; type: number; name?: string; from?: number; to?: number; start_ts?: Timestamp }
  /** `guild_event_soon` fires 15 min before a scheduled slot, `guild_event_start` at its start */
  | {
      ev: "guild_event_soon" | "guild_event_start";
      type: number;
      name?: string;
      start_ts: Timestamp;
      end_ts?: Timestamp;
      /** seconds until start (negative once started) */
      starts_in: number;
      boss?: string | number;
      arena_type?: number;
    };

export type GuildWarEvent =
  /** the league opponent changed */
  | ({ ev: "guildwar_opponent" } & GuildWarOpponent)
  /** matchmaking found a match; the opponent is only known once the match is finished */
  | { ev: "guildwar_match_found"; ts: Timestamp }
  /** a finished match appeared in the history; `players` is our roster */
  | {
      ev: "guildwar_match";
      space_id: string;
      ts: Timestamp;
      mode: GuildWarMode;
      round?: number;
      win: boolean;
      score: GuildWarMatch["score"];
      enemy: GuildWarMatch["enemy"];
      players: GuildWarPlayer[];
      enemy_count: number;
    };
