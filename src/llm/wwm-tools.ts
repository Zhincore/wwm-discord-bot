import * as z from 'zod';

import { GUILD_NAME } from '#consts.ts';
import type {
  GuildMember,
  GuildPart,
  GuildParts,
  GuildWarMatch,
  Named,
  NoGuild,
  PlayerInclude,
  PlayerLoadout,
  RelatedPlayer,
} from '#wwm/proxy/wwm-api.d.ts';
import { WwmApiError } from '#wwm/proxy/wwm-proxy.ts';
import type { WwmService } from '#wwm/wwm.service.ts';

import { formatClock, formatTime } from './time-format';
import { defineTool, type Tool } from './tool-agent';

const MAX_MEMBERS = 20;
const MAX_LOG_ENTRIES = 20;
const MAX_MATCHES = 5;
const MAX_MATCH_PLAYERS = 10;
const MAX_EVENTS = 10;
const MAX_GUILDS = 10;
const SERVER_UTC_OFFSET_HOURS = 8;
const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/** Letters and digits only, lowercased: "CZ-Lamy" and "cz lamy" compare equal. */
const plainName = (name = '') =>
  name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/** Guild log categories as the API numbers them */
const LOG_KINDS = {
  members: 1,
  ranks: 2,
  construction: 3,
  events: 4,
  guild_war: 5,
} as const;

const MEMBER_SORTS = {
  /** online first, then most recently seen */
  recent: (a: GuildMember, b: GuildMember) =>
    Number(b.online) - Number(a.online) ||
    (b.logout_ts ?? 0) - (a.logout_ts ?? 0),
  /** longest offline first */
  inactive: (a: GuildMember, b: GuildMember) =>
    Number(a.online) - Number(b.online) ||
    (a.logout_ts ?? 0) - (b.logout_ts ?? 0),
  weekly_contribution: (a: GuildMember, b: GuildMember) =>
    (b.week_fund ?? 0) - (a.week_fund ?? 0),
  total_contribution: (a: GuildMember, b: GuildMember) =>
    (b.fund ?? 0) - (a.fund ?? 0),
} as const;

const guildParam = z
  .string()
  .optional()
  .describe('Guild name or numeric guild ID. Omit for our own guild.');

type GuildChoices = {
  note: string;
  guilds: ReturnType<typeof shapeGuildResult>[];
};

function shapeGuildResult(guild: {
  id?: number;
  name?: string;
  level?: number;
  member_count?: number;
}) {
  return {
    name: guild.name,
    id: guild.id,
    level: guild.level,
    members: guild.member_count,
  };
}

function presence(player: { online?: boolean; logout_ts?: number }) {
  if (player.online) return 'online';
  return player.logout_ts
    ? `last seen ${formatTime(player.logout_ts)}`
    : 'offline';
}

/** Name of a game entity, or a placeholder when the game has no text for its id. */
function named(entry?: Named) {
  return entry && (entry.name ?? `unknown (#${entry.id})`);
}

type Gear = PlayerLoadout['equipment'][number];

/** One worn item as its slot, set and readable stats; the item name says little in this game. */
function shapeGear(item: Gear) {
  const stat = (s: { name?: string; text?: string; value?: number }) =>
    `${s.name ?? 'unknown stat'} ${s.text ?? s.value ?? ''}`.trim();
  return {
    slot: item.slot_name ?? `slot ${item.slot}`,
    stars: item.star,
    level: item.level,
    set: item.set?.name,
    base_stats: item.base?.map(stat),
    stats: item.affixes?.map(stat),
    effect: item.effect?.name,
  };
}

/** How many worn pieces belong to each gear set, e.g. `{ Mistwillow: 4 }`. */
function gearSets(gear: Gear[]) {
  const sets: Record<string, number> = {};
  for (const { set } of gear) {
    if (set?.name) sets[set.name] = (sets[set.name] ?? 0) + 1;
  }
  return sets;
}

/** Every stat summed over all worn items (base attributes and rolled stats), in the game's format. */
function gearTotals(gear: Gear[]) {
  const totals = new Map<string, { sum: number; percent: boolean }>();
  for (const item of gear) {
    for (const s of [...(item.base ?? []), ...(item.affixes ?? [])]) {
      if (!s.name || typeof s.value !== 'number') continue;
      const total = totals.get(s.name) ?? {
        sum: 0,
        percent: s.text?.endsWith('%') ?? false,
      };
      total.sum += s.value;
      totals.set(s.name, total);
    }
  }
  return Object.fromEntries(
    [...totals].map(([name, { sum, percent }]) => [
      name,
      percent
        ? `${(sum * 100).toFixed(1)}%`
        : String(Math.round(sum * 10) / 10),
    ]),
  );
}

/**
 * Replace the server-clock times in a guild log line with Discord tags:
 * "Sat 01:30 (UTC+8)" becomes the first such moment after the entry, "02:00 (UTC+8)" a time of day.
 */
function localTimes(text: string, entryTs: number) {
  const offset = SERVER_UTC_OFFSET_HOURS * 3600;
  const server = new Date((entryTs + offset) * 1000);
  const midnight = Math.floor((entryTs + offset) / 86_400) * 86_400;
  const today = (server.getUTCDay() + 6) % 7;
  return text.replace(
    /(:)?(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun) )?(\d{2}):(\d{2}) \(UTC\+8\)(;)?/g,
    (_, label, day: string | undefined, hour: string, minute: string, more) => {
      // the game writes "Boss:time;Boss:time"; spell it out as "Boss on time, Boss on time"
      const wrap = (tag: string) =>
        `${label ? ' on ' : ''}${tag}${more ? ', ' : ''}`;
      const clock = Number(hour) * 3600 + Number(minute) * 60;
      if (!day) return wrap(formatClock(midnight + clock - offset));
      const index = WEEKDAYS.findIndex((name) => name.startsWith(day));
      let ts = midnight + ((index - today + 7) % 7) * 86_400 + clock - offset;
      if (ts <= entryTs) ts += 7 * 86_400;
      return wrap(`<t:${ts}:f>`);
    },
  );
}

function shapeRelated(player: RelatedPlayer) {
  return {
    name: player.name,
    uid: player.uid,
    level: player.level,
    status: presence(player),
  };
}

function shapeMatch(match: GuildWarMatch) {
  const active = match.players.filter(
    (p) => p.kills || p.deaths || p.assists || p.total_damage,
  );
  return {
    time: formatTime(match.ts),
    mode: String(match.mode),
    result: match.win ? 'win' : 'loss',
    enemy_guild: match.enemy.name,
    enemy_level: match.enemy.level,
    walkover: match.enemy_players.length === 0 || undefined,
    mvp: [...match.players, ...match.enemy_players].find((p) => p.mvp)?.name,
    our_best_player: match.players.find((p) => p.team_mvp)?.name,
    roster: match.players.length,
    idle: match.players.length - active.length,
    players_shown: Math.min(active.length, MAX_MATCH_PLAYERS),
    players: active.slice(0, MAX_MATCH_PLAYERS).map((p) => ({
      name: p.name,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
    })),
  };
}

/** `[hour, minute]` of the game server's clock as a Discord time-of-day tag. */
function serverClock([hour = 0, minute = 0]: number[]) {
  const today = new Date();
  today.setUTCHours(hour - SERVER_UTC_OFFSET_HOURS, minute, 0, 0);
  return formatClock(today.getTime() / 1000);
}

/** Await a game API call, turning failures into sentences the model can relay. */
async function call<T>(
  request: Promise<T | undefined>,
  notFound: string,
): Promise<T> {
  let response: T | undefined;
  try {
    response = await request;
  } catch (error) {
    if (!(error instanceof WwmApiError) || error.status >= 502) {
      throw new Error('The game is not reachable right now.', { cause: error });
    }
    if (error.status === 404) throw new Error(notFound, { cause: error });
    if (error.status === 409) {
      throw new Error('That data is not loaded yet, try again in a minute.', {
        cause: error,
      });
    }
    throw error;
  }
  if (response === undefined) throw new Error('Game data is not configured.');
  return response;
}

/** The tools Chirpy answers game questions with; results are small, flat and already readable. */
export function createWwmTools(wwm: WwmService): Tool[] {
  /** Numeric ID of the named guild, `undefined` for our own, or candidates when the name is ambiguous. */
  async function resolveGuild(
    guild?: string,
  ): Promise<string | undefined | GuildChoices> {
    const name = guild?.trim();
    if (!name || name.toLowerCase() === GUILD_NAME?.toLowerCase()) return;
    if (/^\d+$/.test(name)) return name;

    const notFound = `No guild named "${name}" found.`;
    const search = async (query: string) => {
      const found = await call(
        wwm.searchGuilds(query, MAX_GUILDS),
        notFound,
      ).catch((error: Error) => {
        if (error.message === notFound) return [];
        throw error;
      });
      return found.filter((g) => g.id !== undefined);
    };
    const exactOf = (found: Awaited<ReturnType<typeof search>>) =>
      found.filter((g) => plainName(g.name) === plainName(name));

    let results = await search(name);
    if (exactOf(results).length !== 1) {
      // The game matches whole words only, so a full name such as "CZ-Lamy" can find nothing.
      const words = [...new Set(name.split(/[^\p{L}\p{N}]+/u))]
        .filter((word) => word.length >= 3 && word !== name)
        .sort((x, y) => y.length - x.length)
        .slice(0, 3);
      for (const word of words) {
        const known = new Set(results.map((g) => g.id));
        results.push(...(await search(word)).filter((g) => !known.has(g.id)));
        if (exactOf(results).length === 1) break;
      }
    }

    const exact = exactOf(results);
    const match = exact.length === 1 ? exact : results;
    if (match.length === 1) return String(match[0]!.id);
    if (match.length === 0) throw new Error(notFound);
    return {
      note: 'Several guilds match. Ask the user which one they mean.',
      guilds: match.map(shapeGuildResult),
    };
  }

  /** Members of our own guild whose name equals `name` ignoring case and punctuation, else those containing it. */
  async function guildMembersLike(name: string) {
    const wanted = plainName(name);
    if (!wanted) return [];
    const data = await wwm.fetchGuildPart('members').catch(() => undefined);
    if (!data || 'club' in data) return [];
    const all = Object.values(data.members);
    const exact = all.filter((m) => plainName(m.name) === wanted);
    if (exact.length || wanted.length < 3) return exact;
    return all.filter((m) => plainName(m.name).includes(wanted));
  }

  /** Fetch one part of the guild the model named and shape it. */
  async function guildPart<K extends keyof GuildParts>(
    part: K,
    guild: string | undefined,
    shape: (data: GuildPart<K>) => object,
  ) {
    const id = await resolveGuild(guild);
    if (typeof id === 'object') return id;
    const data: GuildPart<K> | NoGuild = await call(
      wwm.fetchGuildPart(part, id),
      `No guild with ID ${id} found.`,
    );
    if ('club' in data) throw new Error('The bot is not in a guild.');
    return { ...shape(data), as_of: formatTime(data.updated) };
  }

  return [
    defineTool({
      name: 'guild_info',
      description:
        'Get a summary of one guild: level, funds, number of members, how many are online, and the guild notice. Use for general questions about a guild. Leave guild out for our own guild.',
      schema: z.object({ guild: guildParam }),
      execute: ({ guild }) =>
        guildPart('base', guild, ({ base }) => ({
          name: base.name,
          id: base.id,
          level: base.level,
          funds: base.fund,
          members: base.member_count,
          online: base.online_count,
          notice: base.notice || undefined,
        })),
    }),

    defineTool({
      name: 'guild_members',
      description:
        'List the members of a guild with level, ranks, whether they are online or when they were last seen, and their weekly and total contribution. Use for questions like who is online, who holds a rank, who is inactive, or who contributed most. Leave guild out for our own guild.',
      schema: z.object({
        guild: guildParam,
        role: z
          .string()
          .optional()
          .describe(
            'Return only members holding this rank, for example Guild Leader, Vice Master or Command.',
          ),
        online_only: z
          .boolean()
          .optional()
          .describe('Set to true to return only members who are online now.'),
        sort: z
          .enum([
            'recent',
            'inactive',
            'weekly_contribution',
            'total_contribution',
          ])
          .optional()
          .describe(
            'Order of the list: recent (default) puts online and recently seen members first, inactive puts the longest offline first, the contribution options put the highest first.',
          ),
      }),
      execute: ({ guild, role, online_only, sort = 'recent' }) =>
        guildPart('members', guild, ({ members }) => {
          const all = Object.values(members);
          const wanted = role?.trim().toLowerCase();
          const holds = (exact: boolean) => (m: GuildMember) =>
            m.roles.some((r) =>
              exact
                ? r.toLowerCase() === wanted
                : r.toLowerCase().includes(wanted!),
            );
          let matching = all;
          if (wanted) {
            matching = all.filter(holds(true));
            if (matching.length === 0) matching = all.filter(holds(false));
          }
          if (online_only) matching = matching.filter((m) => m.online);
          const shown = matching
            .toSorted(MEMBER_SORTS[sort])
            .slice(0, MAX_MEMBERS);

          return {
            total: matching.length,
            shown: shown.length,
            ranks_in_guild:
              wanted && matching.length === 0
                ? [...new Set(all.flatMap((m) => m.roles))].sort()
                : undefined,
            members: shown.map((m) => ({
              name: m.name,
              uid: m.uid,
              level: m.level,
              ranks: m.roles,
              status: presence(m),
              weekly_contribution: m.week_fund,
              total_contribution: m.fund,
            })),
          };
        }),
    }),

    defineTool({
      name: 'guild_events',
      description:
        "Get a guild's scheduled events (Breaking Army, Showdown, Guild Party) with their start times and bosses. Use for questions about when an event happens or what is next. Leave guild out for our own guild.",
      schema: z.object({ guild: guildParam }),
      execute: ({ guild }) =>
        guildPart('events', guild, ({ events }) => {
          const now = Date.now() / 1000;
          const plays = Object.values(events);
          const upcoming = plays
            .flatMap((play) =>
              [...play.schedule, ...play.next_week_schedule].map((slot) => ({
                play,
                slot,
              })),
            )
            .filter(({ slot }) => (slot.end_ts ?? slot.start_ts ?? 0) > now)
            .sort((a, b) => (a.slot.start_ts ?? 0) - (b.slot.start_ts ?? 0));

          return {
            total: upcoming.length,
            shown: Math.min(upcoming.length, MAX_EVENTS),
            events: upcoming.slice(0, MAX_EVENTS).map(({ play, slot }) => ({
              name: play.name,
              start: slot.start_ts && formatTime(slot.start_ts),
              end: slot.end_ts && formatTime(slot.end_ts),
              boss: slot.boss === undefined ? undefined : String(slot.boss),
            })),
            unscheduled: plays
              .filter((p) => !p.schedule.length && !p.next_week_schedule.length)
              .map((play) => ({
                name: play.name,
                start:
                  play.start_ts && play.start_ts > now
                    ? formatTime(play.start_ts)
                    : undefined,
                auto_starts_at:
                  play.auto_start && play.open_time.length
                    ? serverClock(play.open_time)
                    : undefined,
              })),
          };
        }),
    }),

    defineTool({
      name: 'guild_log',
      description:
        "Get recent entries from a guild's log: members joining, leaving or being removed, rank changes, guild and building upgrades, and event schedule changes. Use for questions about what happened recently in a guild. Leave guild out for our own guild.",
      schema: z.object({
        guild: guildParam,
        kind: z
          .enum(['members', 'ranks', 'construction', 'events', 'guild_war'])
          .optional()
          .describe('Return only entries of this category.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_LOG_ENTRIES)
          .optional()
          .describe('How many entries to return, newest first. Default 10.'),
      }),
      execute: ({ guild, kind, limit = 10 }) =>
        guildPart('log', guild, ({ log }) => {
          const matching = kind
            ? log.filter((entry) => entry.type === LOG_KINDS[kind])
            : log;
          const shown = matching
            .toSorted((a, b) => b.ts - a.ts)
            .slice(0, limit);
          return {
            total: matching.length,
            shown: shown.length,
            entries: shown.map((entry) => ({
              time: formatTime(entry.ts),
              category: entry.title.replace(/^\[|\]$/g, ''),
              text: localTimes(entry.text, entry.ts),
            })),
          };
        }),
    }),

    defineTool({
      name: 'guild_war',
      description:
        "Get our own guild's Guild War data. Use schedule for when the next Guild War matches start. Use standing for league rank, score, win and loss record and the current opponent. Use matches for recent match results, including each of our players' kills, deaths, assists and who was MVP. Only available for our own guild.",
      schema: z.object({
        what: z
          .enum(['schedule', 'standing', 'matches'])
          .describe('schedule, standing or matches, see the tool description.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_MATCHES)
          .optional()
          .describe('Only with matches: how many recent matches. Default 3.'),
      }),
      execute: async ({ what, limit = 3 }) => {
        what = what.trim() as typeof what;
        const notFound = 'No Guild War data found.';
        if (what === 'matches') {
          const { matches, updated } = await call(
            wwm.fetchGuildWarPart('matches'),
            notFound,
          );
          const shown = matches.toSorted((a, b) => b.ts - a.ts).slice(0, limit);
          return {
            total: matches.length,
            shown: shown.length,
            matches: shown.map(shapeMatch),
            as_of: formatTime(updated),
          };
        }

        if (what === 'schedule') {
          const { schedule, updated } = await call(
            wwm.fetchGuildWarPart('schedule'),
            notFound,
          );
          const upcoming = schedule.next_match_ts ?? [];
          return {
            season: schedule.season,
            season_name: schedule.season_name,
            match_days: schedule.weekdays?.map((day) => WEEKDAYS[day - 1]),
            next_matches: upcoming.length
              ? upcoming.map((ts) => formatTime(ts))
              : 'start time unknown',
            note: 'League and matchmaking matches both start at these times.',
            as_of: formatTime(updated),
          };
        }

        const [{ league, updated }, { matchmaking }] = await Promise.all([
          call(wwm.fetchGuildWarPart('league'), notFound),
          call(wwm.fetchGuildWarPart('matchmaking'), notFound),
        ]);
        const { opponent } = league;
        return {
          league: {
            season: league.season,
            rank: league.rank,
            score: league.score,
            wins: league.win_count,
            opponent: opponent
              ? {
                  name: opponent.name,
                  level: opponent.level,
                  rank: opponent.rank,
                  score: opponent.score,
                  wins: opponent.win_count,
                }
              : 'none assigned',
          },
          matchmaking: {
            season: matchmaking.season,
            round: matchmaking.round,
            score: matchmaking.score,
            wins: matchmaking.win_count,
            losses: matchmaking.lose_count,
          },
          as_of: formatTime(updated),
        };
      },
    }),

    defineTool({
      name: 'find_player',
      description:
        'Look up one player by name or numeric UID. Returns level, sect, and whether they are online or when they were last seen. Add include only when the question asks for it: guild for which guild they are in and their contribution to it, pvp for their arena rank and record, build for their martial arts, inner ways, mystic skills and gear sets, gear for the stats of every worn item plus totals over all gear, cohort for their cohort members.',
      schema: z.object({
        player: z
          .string()
          .describe(
            'Player name as the user wrote it, or numeric UID. Prefer the UID when you know it.',
          ),
        include: z
          .array(z.enum(['guild', 'pvp', 'build', 'gear', 'cohort']))
          .optional()
          .describe('Extra groups to return; omit for the basic profile.'),
      }),
      execute: async ({ player, include = [] }) => {
        const who = player.trim();
        const notFound = `No player named "${who}" found.`;
        const wants = (group: (typeof include)[number]) =>
          include.includes(group);
        const groups = [
          ...new Set(
            include.flatMap((group): PlayerInclude[] =>
              group === 'cohort' ? [] : group === 'gear' ? ['build'] : [group],
            ),
          ),
        ];
        const fetch = (id: string) =>
          Promise.all([
            call(wwm.fetchPlayer(id, groups), notFound),
            wants('cohort')
              ? call(wwm.fetchPlayerCohort(id), notFound)
              : undefined,
          ]);

        let found: Awaited<ReturnType<typeof fetch>>;
        try {
          found = await fetch(who);
        } catch (error) {
          if (!(error instanceof Error) || error.message !== notFound) {
            throw error;
          }
          // The game finds only the exact nickname, so fall back to our guild's member list.
          const matches = await guildMembersLike(who);
          if (matches.length === 0) throw error;
          if (matches.length > 1) {
            return {
              note: 'No player has exactly this name, but these members of our guild are close. Ask the user which one they mean.',
              players: matches
                .slice(0, MAX_GUILDS)
                .map((m) => ({ name: m.name, uid: m.uid, level: m.level })),
            };
          }
          found = await fetch(matches[0]!.uid);
        }
        const [profile, cohort] = found;
        const gear = profile.loadout?.equipment ?? [];

        return {
          name: profile.name,
          uid: profile.uid,
          level: profile.level,
          sect: named(profile.sect),
          status: presence(profile),
          guild: profile.guild && {
            name: profile.guild.name ?? 'not in a guild',
            id: profile.guild.id,
            weekly_contribution: profile.guild.week_fund,
            total_contribution: profile.guild.fund,
            guild_war_season: profile.guildwar?.season,
            guild_war_league_joins: profile.guildwar?.league_joins,
            guild_war_matchmaking_joins: profile.guildwar?.matchmaking_joins,
          },
          pvp: profile.pvp && {
            grade: profile.pvp.grade,
            sub_grade: profile.pvp.small_grade,
            matches: profile.pvp.matches,
            best_streak: profile.pvp.best_streak,
          },
          build: wants('build')
            ? profile.loadout && {
                martial_arts: [
                  named(profile.loadout.martial_arts.main),
                  named(profile.loadout.martial_arts.sub),
                ].filter(Boolean),
                inner_ways: profile.loadout.inner_ways.map(named),
                mystic_skills: profile.loadout.mystic_skills.map(named),
                gear_sets: gearSets(gear),
              }
            : undefined,
          gear:
            wants('gear') && profile.loadout
              ? {
                  sets: gearSets(gear),
                  stat_totals: gearTotals(gear),
                  note: 'Totals cover worn gear only, not the full character sheet.',
                  items: gear.map(shapeGear),
                }
              : undefined,
          cohort:
            cohort &&
            (cohort.id
              ? {
                  name: cohort.name,
                  total: cohort.member_count,
                  shown: Math.min(cohort.members.length, MAX_MEMBERS),
                  members: cohort.members
                    .slice(0, MAX_MEMBERS)
                    .map(shapeRelated),
                }
              : 'not in a cohort'),
          as_of: formatTime(profile.fetched),
        };
      },
    }),

    defineTool({
      name: 'find_guild',
      description:
        'Search for guilds by a word from their name. Use this when the user names a guild you have not looked up yet, or is unsure of the exact name. The search matches whole words, so search for one distinctive word rather than the full name.',
      schema: z.object({
        name: z.string().describe("One word from the guild's name."),
      }),
      execute: async ({ name }) => {
        const word = name.trim();
        const results = await call(
          wwm.searchGuilds(word, MAX_GUILDS),
          `No guild matching "${word}" found.`,
        );
        if (results.length === 0) {
          throw new Error(`No guild matching "${word}" found.`);
        }
        return {
          shown: Math.min(results.length, MAX_GUILDS),
          guilds: results.slice(0, MAX_GUILDS).map(shapeGuildResult),
          as_of: formatTime(Date.now() / 1000),
        };
      },
    }),
  ];
}
