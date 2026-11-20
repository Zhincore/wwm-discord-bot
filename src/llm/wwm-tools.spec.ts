import { WwmApiError } from '#wwm/proxy/wwm-proxy.ts';
import type { WwmService } from '#wwm/wwm.service.ts';

import type { Tool } from './tool-agent';
import { createWwmTools } from './wwm-tools';

const NOW = 1_795_000_000;
const HOUR = 3600;

const member = (uid: string, extra: object = {}) => ({
  pid: `pid-${uid}`,
  uid,
  name: `Player${uid}`,
  level: 80,
  roles: ['Member'],
  online: false,
  logout_ts: NOW - Number(uid) * HOUR,
  fund: Number(uid) * 10,
  week_fund: 100 - Number(uid),
  ...extra,
});

function setup(overrides: Partial<Record<keyof WwmService, unknown>> = {}) {
  const members = Object.fromEntries(
    Array.from({ length: 30 }, (_, i) => [
      String(i + 1),
      member(String(i + 1)),
    ]),
  );
  members['1'] = member('1', { online: true, roles: ['Guild Leader'] });
  members['2'] = member('2', { roles: ['Vice Master'] });

  const wwm = {
    fetchGuildPart: vi.fn(async (part: string) => ({
      updated: NOW,
      club_id: 'c1',
      base: {
        name: 'Ours',
        id: 7,
        level: 5,
        exp: 800,
        exp_needed: 5000,
        fund: 1234,
        member_count: 30,
        online_count: 1,
        notice: 'hi',
      },
      members,
      events: {
        '13': {
          type: 13,
          name: 'Breaking Army',
          open_time: [],
          schedule: [
            {
              start_time: [19, 0],
              start_ts: NOW - 48 * HOUR,
              end_ts: NOW - 47 * HOUR,
              boss: 'Old',
            },
            {
              start_time: [19, 0],
              start_ts: NOW + 5 * HOUR,
              end_ts: NOW + 6 * HOUR,
              boss: 'Ironmaw',
            },
          ],
          next_week_schedule: [],
        },
        '2': {
          type: 2,
          name: 'Guild Party',
          open_time: [20, 30],
          auto_start: true,
          schedule: [],
          next_week_schedule: [],
        },
      },
      log: [
        {
          type: 1,
          event_id: 1,
          players: [],
          ts: NOW - HOUR,
          params: [],
          title: '[Members]',
          text: 'A joined',
        },
        {
          type: 2,
          event_id: 6,
          players: [],
          ts: NOW - 2 * HOUR,
          params: [],
          title: '[Promotion]',
          text: 'B promoted',
        },
      ],
      part,
    })),
    searchGuilds: vi.fn(async () => [
      { id: 11, name: 'CZ-Lamy', level: 4, member_count: 50 },
      { id: 12, name: 'Lamy Elite', level: 2, member_count: 9 },
    ]),
    fetchGuildWarPart: vi.fn(async (part: string) => ({
      updated: NOW,
      club_id: 'c1',
      league: { season: 3, rank: 4, score: 900, fame: 1, win_count: 5 },
      matchmaking: {
        season: 3,
        round: 2,
        win_count: 6,
        lose_count: 1,
        score: 1500,
      },
      schedule: {
        season: 3,
        season_name: 'Ever Aflame',
        weekdays: [6, 7],
        next_match_ts: [NOW + 5 * HOUR, NOW + 29 * HOUR],
      },
      matches: [
        {
          space_id: 'm1',
          ts: NOW - HOUR,
          mode: 'league',
          win: true,
          score: {},
          enemy: { name: 'Foes', level: 3 },
          players: [
            {
              pid: 'a',
              name: 'Ace',
              kills: 9,
              deaths: 1,
              assists: 2,
              total_damage: 5,
              mvp: true,
              team_mvp: true,
            },
            {
              pid: 'b',
              name: 'Idle',
              kills: 0,
              deaths: 0,
              assists: 0,
              total_damage: 0,
            },
          ],
          enemy_players: [],
        },
      ],
      part,
    })),
    fetchPlayer: vi.fn(async () => ({
      fetched: NOW,
      pid: 'secret-pid',
      hostnum: 1,
      name: 'Brasshop',
      uid: '555',
      level: 77,
      sect: { id: 3 },
      online: false,
      logout_ts: NOW - 3 * HOUR,
      online_time: 90 * HOUR + 1200,
      world_level: 17,
      mastery: 26222.4,
      achievements: { '1': 59, '2': 22, '3': 5 },
      linked: { steam: 'steam-id', discord_id: 'discord-id' },
      card: {},
      build_hidden: false,
      guild: {
        id: 7,
        name: 'Ours',
        club_id: 'secret-club',
        fund: 50,
        week_fund: 5,
      },
      loadout: {
        martial_arts: { main: { id: 1, name: 'Nameless Sword' } },
        inner_ways: [{ id: 2, name: 'Way' }],
        mystic_skills: [{ slot: 1, id: 3, name: 'Skill' }],
        equipment: [
          {
            slot: 1,
            slot_name: 'Primary Weapon',
            id: 4,
            name: 'Dustless Veilbright',
            star: 5,
            level: 100,
            set: { id: 25, name: 'Mistwillow' },
            base: [
              {
                key: 'MAX_W_ATK',
                name: 'Max Physical Attack',
                value: 175,
                text: '175',
              },
            ],
            affixes: [
              {
                id: 1,
                name: 'Critical Rate',
                value: 0.097,
                text: '9.7%',
                max: 0.104,
              },
              {
                id: 2,
                name: 'Critical Rate',
                value: 0.05,
                text: '5.0%',
                max: 0.104,
              },
            ],
            effect: { id: 3, name: 'Reduces damage taken by 35%.' },
          },
        ],
      },
    })),
    fetchPlayerCohort: vi.fn(async () => ({
      player: { pid: 'secret-pid', hostnum: 1 },
      member_count: 0,
      members: [],
    })),
    ...overrides,
  } as unknown as WwmService;

  const tools = new Map(createWwmTools(wwm).map((tool) => [tool.name, tool]));
  const run = async (name: string, args: object = {}) => {
    const tool = tools.get(name) as Tool;
    return (await tool.execute(tool.schema.parse(args))) as any;
  };
  return { wwm, run, tools };
}

describe('createWwmTools', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW * 1000 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('defines the seven spec tools', () => {
    expect([...setup().tools.keys()]).toEqual([
      'guild_info',
      'guild_members',
      'guild_events',
      'guild_log',
      'guild_war',
      'find_player',
      'find_guild',
    ]);
  });

  it('guild_info: own guild, readable as_of, no internal ids', async () => {
    const { run, wwm } = setup();
    const result = await run('guild_info');
    expect(wwm.fetchGuildPart).toHaveBeenCalledWith('base', undefined);
    expect(result).toMatchObject({
      name: 'Ours',
      id: 7,
      exp: 800,
      exp_needed_for_next_level: 5000,
      funds: 1234,
      members: 30,
      online: 1,
    });
    expect(result.as_of).toBe(`<t:${NOW}:f> (<t:${NOW}:R>) [note: now]`);
    expect(JSON.stringify(result)).not.toContain('club_id');
  });

  it('guild_members: caps at 20 with total/shown, online first', async () => {
    const { run } = setup();
    const result = await run('guild_members');
    expect(result).toMatchObject({ total: 30, shown: 20 });
    expect(result.members[0]).toMatchObject({
      name: 'Player1',
      status: 'online',
    });
    expect(result.members[1].status).toMatch(/^last seen .*\[note: 2 h ago\]$/);
    expect(JSON.stringify(result)).not.toContain('pid');
  });

  it('guild_members: filters by role and online, sorts before truncating', async () => {
    const { run } = setup();
    expect(await run('guild_members', { role: 'vice master' })).toMatchObject({
      total: 1,
      members: [{ name: 'Player2' }],
    });
    expect(await run('guild_members', { online_only: true })).toMatchObject({
      total: 1,
    });
    const top = await run('guild_members', { sort: 'total_contribution' });
    expect(top.members[0]).toMatchObject({
      name: 'Player30',
      total_contribution: 300,
    });
    const none = await run('guild_members', { role: 'Command' });
    expect(none).toMatchObject({
      total: 0,
      ranks_in_guild: ['Guild Leader', 'Member', 'Vice Master'],
    });
  });

  it('guild_events: upcoming slots only, soonest first', async () => {
    const result = await setup().run('guild_events');
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      name: 'Breaking Army',
      boss: 'Ironmaw',
    });
    expect(result.events[0].start).toBe(
      `<t:${NOW + 5 * HOUR}:f> (<t:${NOW + 5 * HOUR}:R>) [note: in 5 h]`,
    );
    expect(result.unscheduled).toMatchObject([{ name: 'Guild Party' }]);
    expect(result.unscheduled[0].auto_starts_at).toMatch(/^<t:\d+:t>$/);
  });

  it('guild_log: filters by kind and respects limit', async () => {
    const { run } = setup();
    expect(await run('guild_log', { kind: 'ranks' })).toMatchObject({
      total: 1,
      entries: [{ category: 'Promotion', text: 'B promoted' }],
    });
    expect(await run('guild_log', { limit: 1 })).toMatchObject({
      total: 2,
      shown: 1,
    });
  });

  it('guild_log: server-clock times become Discord tags', async () => {
    const at = (iso: string) => Date.parse(iso) / 1000;
    const ts = at('2026-11-18T12:00:00Z');
    const entry = (text: string) => ({ type: 4, ts, title: '[Events]', text });
    const { run } = setup({
      fetchGuildPart: vi.fn(async () => ({
        updated: NOW,
        log: [
          entry(
            'A moved it to Ghost Master:Sat 01:30 (UTC+8);Snake Doctor:Wed 19:00 (UTC+8)',
          ),
          entry('Guild Party starts at 20:30 (UTC+8)'),
        ],
      })),
    });
    const { entries } = await run('guild_log');
    expect(entries.map((e: { text: string }) => e.text)).toEqual([
      `A moved it to Ghost Master on <t:${at('2026-11-20T17:30:00Z')}:f>, Snake Doctor on <t:${at('2026-11-25T11:00:00Z')}:f>`,
      `Guild Party starts at <t:${at('2026-11-18T12:30:00Z')}:t>`,
    ]);
  });

  it('guild_war: standing and matches', async () => {
    const { run } = setup();
    expect(await run('guild_war', { what: 'standing' })).toMatchObject({
      league: { rank: 4, score: 900, opponent: 'none assigned' },
      matchmaking: { wins: 6, losses: 1 },
    });
    const { matches } = await run('guild_war', { what: 'matches' });
    expect(matches[0]).toMatchObject({
      result: 'win',
      enemy_guild: 'Foes',
      walkover: true,
      mvp: 'Ace',
      roster: 2,
      idle: 1,
      players: [{ name: 'Ace', kills: 9, deaths: 1, assists: 2 }],
    });
  });

  it('guild_war: schedule with readable times', async () => {
    const result = await setup().run('guild_war', { what: 'schedule' });
    expect(result).toMatchObject({
      season_name: 'Ever Aflame',
      match_days: ['Saturday', 'Sunday'],
    });
    expect(result.next_matches[0]).toBe(
      `<t:${NOW + 5 * HOUR}:f> (<t:${NOW + 5 * HOUR}:R>) [note: in 5 h]`,
    );
  });

  it('find_player: splits include, shapes build, hides linked accounts', async () => {
    const { run, wwm } = setup();
    const result = await run('find_player', {
      player: ' Brasshop ',
      include: ['build', 'gear', 'cohort'],
    });
    expect(wwm.fetchPlayer).toHaveBeenCalledWith('Brasshop', ['build']);
    expect(wwm.fetchPlayerCohort).toHaveBeenCalledWith('Brasshop');
    expect(result).toMatchObject({
      name: 'Brasshop',
      uid: '555',
      sect: 'unknown (#3)',
      play_time_hours: 90,
      world_level: 17,
      mastery: 26222,
      achievements: 86,
      cohort: 'not in a cohort',
      guild: {
        name: 'Ours',
        id: 7,
        weekly_contribution: 5,
        total_contribution: 50,
      },
      build: {
        martial_arts: ['Nameless Sword'],
        gear_sets: { Mistwillow: 1 },
      },
      gear: {
        sets: { Mistwillow: 1 },
        stat_totals: {
          'Max Physical Attack': '175',
          'Critical Rate': '14.7%',
        },
        items: [
          {
            slot: 'Primary Weapon',
            set: 'Mistwillow',
            base_stats: ['Max Physical Attack 175'],
            stats: ['Critical Rate 9.7%', 'Critical Rate 5.0%'],
            effect: 'Reduces damage taken by 35%.',
          },
        ],
      },
    });
    expect(
      (await run('find_player', { player: 'Brasshop', include: ['build'] }))
        .gear,
    ).toBeUndefined();
    const text = JSON.stringify(result);
    expect(text).not.toMatch(
      /steam-id|discord-id|secret-pid|secret-club|hostnum/,
    );
  });

  it('find_player: falls back to our guild members when the exact name is unknown', async () => {
    const fetchPlayer = vi.fn(async (who: string) => {
      if (!/^\d+$/.test(who)) throw new WwmApiError(404, 'x');
      return { fetched: NOW, name: `Player${who}`, uid: who, level: 80 };
    });
    const { run } = setup({ fetchPlayer });
    const one = await run('find_player', { player: 'player 7' });
    expect(fetchPlayer).toHaveBeenLastCalledWith('7', []);
    expect(one.name).toBe('Player7');
    const several = await run('find_player', { player: 'layer2' });
    expect(several.note).toMatch(/which one/);
    expect(several.players[0]).toEqual({
      name: 'Player2',
      uid: '2',
      level: 80,
    });
    await expect(run('find_player', { player: 'Nobody' })).rejects.toThrow(
      'No player named "Nobody" found.',
    );
  });

  it('resolves a guild name: exact hit, ambiguous list, numeric id, own name', async () => {
    const { run, wwm } = setup();
    await run('guild_info', { guild: 'cz-lamy' });
    expect(wwm.fetchGuildPart).toHaveBeenLastCalledWith('base', '11');
    await run('guild_info', { guild: '42' });
    expect(wwm.fetchGuildPart).toHaveBeenLastCalledWith('base', '42');
    const ambiguous = await run('guild_info', { guild: 'Lamy' });
    expect(ambiguous.guilds).toHaveLength(2);
    expect(ambiguous.note).toMatch(/which one/);
  });

  it('resolves a full guild name the game search cannot find by its words', async () => {
    const searchGuilds = vi.fn(async (query: string) =>
      query === 'Lamy'
        ? [
            { id: 11, name: 'CZ-Lamy', level: 4, member_count: 50 },
            { id: 12, name: 'Lamy Elite', level: 2, member_count: 9 },
          ]
        : [],
    );
    const { run, wwm } = setup({ searchGuilds });
    await run('guild_info', { guild: 'CZ-Lamy' });
    expect(searchGuilds).toHaveBeenCalledWith('Lamy', 10);
    expect(wwm.fetchGuildPart).toHaveBeenLastCalledWith('base', '11');
    await expect(run('guild_info', { guild: 'Nowhere-Else' })).rejects.toThrow(
      'No guild named "Nowhere-Else" found.',
    );
  });

  it('maps API failures to plain sentences', async () => {
    const failing = (error: unknown) =>
      setup({
        fetchPlayer: vi.fn().mockRejectedValue(error),
        fetchGuildPart: vi.fn().mockRejectedValue(error),
      });
    await expect(
      failing(new WwmApiError(404, 'x')).run('find_player', { player: 'Nope' }),
    ).rejects.toThrow('No player named "Nope" found.');
    await expect(
      failing(new WwmApiError(409, 'x')).run('guild_info'),
    ).rejects.toThrow(/not loaded yet/);
    await expect(
      failing(new WwmApiError(503, 'x')).run('guild_info'),
    ).rejects.toThrow(/not reachable/);
    await expect(
      failing(new TypeError('ECONNREFUSED')).run('guild_info'),
    ).rejects.toThrow(/not reachable/);
    const disabled = setup({ fetchGuildPart: vi.fn(async () => undefined) });
    await expect(disabled.run('guild_info')).rejects.toThrow(/not configured/);
    const noGuild = setup({
      fetchGuildPart: vi.fn(async () => ({ club: false })),
    });
    await expect(noGuild.run('guild_info')).rejects.toThrow(/not in a guild/);
  });

  it('rejects out-of-range arguments', () => {
    const { tools } = setup();
    expect(
      tools.get('guild_log')!.schema.safeParse({ limit: 50 }).success,
    ).toBe(false);
    expect(tools.get('guild_war')!.schema.safeParse({}).success).toBe(false);
  });
});
