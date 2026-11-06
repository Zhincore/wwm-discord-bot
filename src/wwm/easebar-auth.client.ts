import { fetchJSON } from '#common/utils.js';

import { RoleDetails, RoleInfo } from './game-profile';

const LOGIN_BASE_URL = 'https://sdk-os.mpsdk.easebar.com/api/users/login/v2';
const LOGIN_BASE_PARAMS =
  'game_id=398&cp=w&cv=3.1.5&gv=1.0.0&app_channel=netease_global.h5activity&device_id=2251945601';

const DATA_BASE_URL = 'https://s2.easebar.com/78ae9d90792a3e9b';

export async function fetchAuthConfig(
  lang: string = 'en_US',
): Promise<AuthConfigResponse> {
  const config = await fetchJSON<AuthConfigResponse>(
    `${LOGIN_BASE_URL}/oauth/config?${LOGIN_BASE_PARAMS}&version=v2&lang=${lang}`,
  );

  return config;
}

export function getLoginMethods(
  config: AuthConfigResponse,
  callbackUrl: string,
  lang: string = 'en_US',
) {
  const redirect =
    `${LOGIN_BASE_URL}/oauth/authorize?` +
    ('redirect_uri=' + encodeURIComponent(callbackUrl));

  return config.data.login_methods.map(({ method, name, allow_platform }) => ({
    name,
    url:
      `${LOGIN_BASE_URL}/${method}/redirect?${LOGIN_BASE_PARAMS}&lang=${lang}&platform=${allow_platform[0]}&scene=login` +
      ('&next_redirect_url=' + encodeURIComponent(redirect)),
  }));
}

export async function fetchRoleList(platform: string, token: string) {
  const tokenData = parseToken<TokenData>(token);

  const result = await fetchSAuth<RoleListResponse>(
    '/login/roleList',
    platform,
    tokenData,
  );
  if (!result.data && (!result.status || !result.success)) {
    throw new Error(`Fetching role list failed: ${result.msg}`);
  }

  return result.data;
}

export async function loginRole(
  platform: string,
  token: string,
  roleId: string,
) {
  const tokenData = parseToken<TokenData>(token);

  const result = await fetchSAuth<RoleLoginResponse>(
    '/login/roleLogin',
    platform,
    tokenData,
    { roleId },
  );
  if (!result.data && (!result.status || !result.success)) {
    throw new Error(`Logging in role failed: ${result.msg}`);
  }

  return { ...result.data, ...parseJwt(result.data.token) };
}

export async function fetchRoleInfo(accessToken: string) {
  const result = await fetchJSON<RoleInfoResult>(
    DATA_BASE_URL + '/role/roleInfo',
    {
      headers: { access_token: accessToken },
    },
  );
  if (!result.data && (!result.status || !result.success)) {
    throw new Error(`Fetching role info failed: ${result.msg}`);
  }

  return result.data;
}

async function fetchSAuth<T>(
  path: string,
  platform: string,
  tokenData: TokenData,
  additionalData?: object,
) {
  return fetchJSON<T>(DATA_BASE_URL + path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      access_token: '',
    },
    body: JSON.stringify({
      loginChannel: 'netease_global',
      appChannel: 'netease_global.h5activity',
      platform: platform,
      sdkuid: `${tokenData.user_id}`,
      sessionid: `${tokenData.access_token}`,
      sdkVersion: '1.0.0',
      udid: '0d3',
      deviceid: `${tokenData.device_id}`,
      ...additionalData,
    }),
  });
}

function parseToken<T>(token: string): T {
  return JSON.parse(Buffer.from(token, 'base64url').toString());
}

function parseJwt(jwt: string): JwtData {
  return parseToken(jwt.split('.')[1]);
}

interface TokenData {
  user_id: number;
  access_token: string;
  device_id: string;
}

interface JwtData {
  /** JSON with nickName and uid etc. */
  sub: string;
  iat: number;
  exp: number;
  iss: string;
}

interface SAuthResponseBase {
  status: boolean;
  success: boolean;
  msg: string;
}

interface AuthConfigResponse extends SAuthResponseBase {
  data: {
    login_methods: {
      allow_platform: string[];
      method: string;
      name: string;
    }[];
  };
}

export interface LoginMethod {
  name: string;
  url: string;
}

interface RoleListResponse extends SAuthResponseBase {
  data: RoleInfo[];
}

interface RoleLoginResponse extends SAuthResponseBase {
  data: { isFirst: boolean; token: string; nickName: string };
}

interface RoleInfoResult extends SAuthResponseBase {
  data: RoleDetails;
}
