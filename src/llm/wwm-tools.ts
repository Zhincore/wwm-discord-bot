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

    const found = await call(
      wwm.searchGuilds(name, MAX_GUILDS),
      `No guild named "${name}" found.`,
    );
    const results = found.filter((g) => g.id !== undefined);
    const exact = results.filter(
      (g) => g.name?.toLowerCase() === name.toLowerCase(),
    );
    const match = exact.length === 1 ? exact : results;
    if (match.length === 1) return String(match[0]!.id);
    if (match.length === 0) {
      throw new Error(
        `No guild named "${name}" found. The search matches whole words; try one distinctive word from the name.`,
      );
    }
    return {
      note: 'Several guilds match. Ask the user which one they mean.',
      guilds: match.map(shapeGuildResult),
    };
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
              text: entry.text,
            })),
          };
        }),
    }),

    defineTool({
      name: 'guild_war',
      description:
        "Get our own guild's Guild War data. Use standing for league rank, score, win and loss record and the current opponent. Use matches for recent match results, including each of our players' kills, deaths, assists and who was MVP. Only available for our own guild.",
      schema: z.object({
        what: z
          .enum(['standing', 'matches'])
          .describe('standing or matches, see the tool description.'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_MATCHES)
          .optional()
          .describe('Only with matches: how many recent matches. Default 3.'),
      }),
      execute: async ({ what, limit = 3 }) => {
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
        'Look up one player by exact name or numeric UID. Returns level, sect, and whether they are online or when they were last seen. Add include only when the question asks for it: guild for which guild they are in and their contribution to it, pvp for their arena rank and record, build for their skills and equipment, cohort for their cohort members.',
      schema: z.object({
        player: z.string().describe('Exact player name or numeric UID.'),
        include: z
          .array(z.enum(['guild', 'pvp', 'build', 'cohort']))
          .optional()
          .describe('Extra groups to return; omit for the basic profile.'),
      }),
      execute: async ({ player, include = [] }) => {
        const who = player.trim();
        const notFound = `No player named "${who}" found.`;
        const groups = include.filter(
          (group): group is PlayerInclude => group !== 'cohort',
        );
        const [profile, cohort] = await Promise.all([
          call(wwm.fetchPlayer(who, groups), notFound),
          include.includes('cohort')
            ? call(wwm.fetchPlayerCohort(who), notFound)
            : undefined,
        ]);

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
          build: profile.loadout && {
            martial_arts: [
              named(profile.loadout.martial_arts.main),
              named(profile.loadout.martial_arts.sub),
            ].filter(Boolean),
            inner_ways: profile.loadout.inner_ways.map(named),
            mystic_skills: profile.loadout.mystic_skills.map(named),
            equipment: profile.loadout.equipment.map((item) => ({
              name: named(item),
              stars: item.star,
              level: item.level,
            })),
          },
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
