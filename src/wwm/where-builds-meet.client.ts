import Path from 'node:path';

import { fetchJSON } from '#common/utils.js';

const LOG_KEY = Path.basename(import.meta.file);

export async function fetchAffixNames() {
  const [affixMap, attunements, gearData] = await Promise.all([
    fetchJSON<AffixMap>(
      'https://github.com/greydust/where-builds-meet/raw/refs/heads/main/data/official/affix-map.json',
    ),
    fetchJSON<Attunements>(
      'https://github.com/greydust/where-builds-meet/raw/refs/heads/main/data/attunement.json',
    ),
    fetchJSON<GearData>(
      'https://github.com/greydust/where-builds-meet/raw/refs/heads/main/data/gear.json',
    ),
  ]);

  const affixes = gearData.affixes;
  return Object.entries(affixMap).map(([id, key]) => {
    const affix = affixes[key] ?? attunements[key];
    if (!affix) console.log(`[${LOG_KEY}] Affix not found ${key}`);
    return {
      id: +id,
      name: affix.name || '???',
    };
  });
}

/** https://github.com/greydust/where-builds-meet/blob/main/data/official/affix-map.json
 * WWM ID to WBM id
 */
type AffixMap = Record<string, string>;

/** https://github.com/greydust/where-builds-meet/blob/main/data/gear.json */
interface GearData {
  /** leftWeapon -> "Left Weapon" */
  slots: Record<string, string>;
  affixes: Record<string, { name: string }>;
}

type Attunements = Record<string, { name: string }>;
