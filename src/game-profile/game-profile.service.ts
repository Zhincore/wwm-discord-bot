import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Snowflake } from 'discord.js';
import { and, eq, isNull, lt, or, sql } from 'drizzle-orm';
import Hashids from 'hashids';
import ms from 'ms';

import { DatabaseService } from '#common/database/database.service.js';
import { FetchCache } from '#common/fetch-cache.js';
import {
  fetchAuthConfig,
  fetchRoleInfo,
  fetchRoleList,
  getLoginMethods,
  loginRole,
} from '#wwm/easebar-auth.client.js';
import {
  WwmSect,
  WwmBanner,
  WwmEleganceLevel,
  WwmMartialArt,
} from '#wwm/game-data.client.js';
import { GameDataService } from '#wwm/game-data.service.js';

import { gameProfiles } from './game-profile.schema';

@Injectable()
export class GameProfileService {
  #hashids = new Hashids(process.env.SALT, 8);
  #authConfigs = new FetchCache((lang: string) => fetchAuthConfig(lang), {
    ttl: ms('12h'),
  });

  #createEmptyProfile;
  #createMemberProfile;
  #getMemberProfile;
  #setProfileToken;
  #deleteOldAttempts;

  constructor(
    db: DatabaseService,
    private readonly gameData: GameDataService,
  ) {
    const id = sql.placeholder('id');
    const memberId = sql.placeholder('memberId');
    const token = sql.placeholder('token');

    this.#createEmptyProfile = db
      .insert(gameProfiles)
      .values({})
      .returning({ id: gameProfiles.id })
      .prepare();

    this.#createMemberProfile = db
      .insert(gameProfiles)
      .values({ memberId })
      .returning({ id: gameProfiles.id })
      .prepare();

    this.#getMemberProfile = db
      .select()
      .from(gameProfiles)
      .where(eq(gameProfiles.memberId, memberId))
      .prepare();
    this.#setProfileToken = db
      .update(gameProfiles)
      .set({ session: token })
      .where(eq(gameProfiles.id, id))
      .prepare();

    this.#deleteOldAttempts = db
      .delete(gameProfiles)
      .where(
        and(
          or(isNull(gameProfiles.memberId), isNull(gameProfiles.session)),
          lt(gameProfiles.createdAt, sql`unixepoch('now', '-1 day')`),
        ),
      )
      .prepare();
  }

  @Cron(CronExpression.EVERY_12_HOURS)
  public async cleanUpSessions() {
    await this.#deleteOldAttempts.execute();
  }

  public async getLoginMethodsWeb(lang: string = 'en_US') {
    const { id } = this.#createEmptyProfile.get();

    return this.getLoginMethods(this.#hashids.encode(id), lang);
  }

  public async getLoginMethodsDiscord(
    memberId: Snowflake,
    lang: string = 'en_US',
  ) {
    let profile: { id: number } | undefined = this.#getMemberProfile.get({
      memberId,
    });
    if (!profile) {
      profile = this.#createMemberProfile.get({ memberId });
    }

    return this.getLoginMethods(this.#hashids.encode(profile.id), lang);
  }

  private async getLoginMethods(userId: string, lang: string = 'en_US') {
    const callbackUrl =
      process.env.PUBLIC_URL!.replace(/\/+$/, '') +
      `/game-profile/${userId}/callback`;

    const config = await this.#authConfigs.get(lang);
    return getLoginMethods(config, callbackUrl);
  }

  public async getRoleList(platform: string, token: string) {
    return fetchRoleList(platform, token);
  }

  public async loginRole(
    userId: string,
    platform: string,
    token: string,
    roleId: string,
  ) {
    const auth = await loginRole(platform, token, roleId);

    this.#setProfileToken.run({
      id: this.#hashids.decode(userId)[0],
      token: auth.token,
    });
  }

  private async fetchProfile(memberId: Snowflake) {
    const result = this.#getMemberProfile.get({ memberId });
    if (
      !result?.session ||
      (result.expiresAt && +result.expiresAt < Date.now())
    )
      return;

    return fetchRoleInfo(result.session);
  }

  public async getResolvedProfile(memberId: Snowflake) {
    const data = await this.fetchProfile(memberId);
    if (!data) return;

    const avatar = this.gameData.get('avatar', +data.roleAvatar);
    const sect = this.gameData.get('sect', data.school);
    const banner = this.gameData.get('banner', data.bg);
    const eleganceLevel = this.gameData.getElegance(data.fashionScore);

    // const mainMartialArt = this.gameData.get('martialArt', data.kongfuMain);
    // const subMartialArt = this.gameData.get('martialArt', data.kongfuSub);
    const [mainMartialArt, subMartialArt] = this.gameData.getMultiple(
      'martialArt',
      [data.kongfuMain, data.kongfuSub],
    );

    // const mainAffix = this.gameData.get("affix", data.wearEquipsDetailed[])

    return {
      uid: data.roleId,
      name: data.roleName,
      avatarUrl: avatar?.pic_url,
      bodyType: data.bodyType,
      level: data.level,
      createdDays: data.crDay,
      onlineTimeMs: data.onlineTime * 1000,
      sect,
      banner,
      maxMartialMastery: data.maxXiuWeiKungFu,
      martialMastery: data.xiuWeiKungFu,
      eleganceScore: data.fashionScore,
      eleganceLevel,
      mainMartialArt,
      subMartialArt,
    } as ResolvedProfile;
  }
}

interface ResolvedProfile {
  uid: string;
  name: string;
  avatarUrl?: string;
  bodyType: 0 | 1;
  level: number;
  createdDays: number;
  onlineTimeMs: number;
  sect?: WwmSect;
  banner?: WwmBanner;
  maxMartialMastery: number;
  martialMastery: number;
  eleganceScore: number;
  eleganceLevel: WwmEleganceLevel;
  mainMartialArt?: WwmMartialArt;
  subMartialArt?: WwmMartialArt;
}
