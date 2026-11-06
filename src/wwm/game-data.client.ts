const t = <T>() => null as T;
const WWM_DATA_KIND_MAP = {
  sect: { filename: 'base_school', type: t<WwmSectsData>() },
  gear: { filename: 'equip', type: t<WwmGearData>() },
  elegance: { filename: 'fashion_level', type: t<WwmEleganceLevels>() },
  avatar: { filename: 'head', type: t<WwmAvatarsData>() },
  martialArt: { filename: 'kongfu', type: t<WwmMartialArtsData>() },
  banner: { filename: 'name_card_bg', type: t<WwmBannersData>() },
  mysticSkill: { filename: 'qishu', type: t<WwmMysticSkillsData>() },
  innerWay: { filename: 'xinfa', type: t<WwmInnerWaysdata>() },
} as const;
type WwmDataKinds = typeof WWM_DATA_KIND_MAP;
export const WWM_DATA_KINDS = Object.keys(WWM_DATA_KIND_MAP);
export type WwmDataKind = keyof WwmDataKinds;
export type WwmDataKindTypes = {
  [K in WwmDataKind]: Item<WwmDataKinds[K]['type']>;
};

type Item<T> = T extends (infer P)[]
  ? P
  : T extends Record<string, infer P>
    ? P
    : never;

export async function fetchGameData<K extends WwmDataKind>(
  kind: K,
): Promise<WwmDataKinds[K]['type']> {
  const n = WWM_DATA_KIND_MAP[kind].filename;
  const response = await fetch(
    `https://www.wherewindsmeetgame.com/pc/qt/20251203102905/data/${n}/${n}.txt`,
  );
  if (!response.ok)
    throw new Error(`Failed to fetch ${kind} data: ${response.statusText}`);

  return JSON.parse(decodeGameData(await response.bytes()).toString('utf-8'));
}

const CHUNK = 100;
const isWhitespace = (b: number) => b === 0x20 || (b >= 0x09 && b <= 0x0d);

/**
 * Trims, reverses, drops the last byte of every 100-byte chunk
 * (including a trailing partial chunk), then base64-decodes.
 */
function decodeGameData(bytes: Uint8Array): Buffer {
  let start = 0;
  let end = bytes.length;
  while (start < end && isWhitespace(bytes[start])) start++;
  while (end > start && isWhitespace(bytes[end - 1])) end--;

  const len = end - start;
  const out = new Uint8Array(len);
  let j = 0;
  for (let r = 0; r < len; r++) {
    if (r % CHUNK === CHUNK - 1) continue;
    out[j++] = bytes[end - 1 - r];
  }
  if (len % CHUNK !== 0) j--;

  return Buffer.from(
    Buffer.from(out.buffer, 0, j).toString('latin1'),
    'base64',
  );
}

/** base_school */
type WwmSectsData = Record<string, WwmSect>;
export interface WwmSect {
  id: number;
  name: string;
  menpai_pic_url: string;
}

/** equip */
type WwmGearData = Record<string, WwmGear>;
export interface WwmGear {
  id: number;
  name: '';
  icon_url: string;
  long_icon_url: string;
  star: number;
}

/** fashion_level */
type WwmEleganceLevels = WwmEleganceLevel[];
export interface WwmEleganceLevel {
  id: number;
  name: string;
  score?: number;
  icon: string;
  icon_url: string;
}

/** head */
type WwmAvatarsData = Record<string, WwmAvatar>;
export interface WwmAvatar {
  id: number;
  pic_url: string;
}

/** kongfu */
type WwmMartialArtsData = Record<string, WwmMartialArt>;
export interface WwmMartialArt {
  id: number;
  name?: string;
  pic_url: string;
  /** Path icon */
  liupai_pic_url?: string;
  liupai_name: '';
  is_post: 0 | 1;
}

/** name_card_bg */
type WwmBannersData = Record<string, WwmBanner>;
export interface WwmBanner {
  id: number;
  name: '';
  pic_url: string;
}

/** qishu */
type WwmMysticSkillsData = Record<string, WwmMysticSKill>;
export interface WwmMysticSKill {
  id: number;
  name: string;
  pic_url: string;
}

/** xinfa */
type WwmInnerWaysdata = Record<string, WwmInnerWay>;
export interface WwmInnerWay {
  id: number;
  name: string;
  icon_url: string;
  bg_icon_url: string;
  /** small square path icon */
  liupai_pic_url: string;
  /** horizontal path icon */
  liupai_pic_big_url: string;
  is_post?: 0 | 1;
  type_name: '';
}
