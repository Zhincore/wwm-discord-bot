import { fetchJSON } from '#common/utils.js';

import { CodesSource } from './source.js';

export const CODES_API_URL =
  'https://codes-backend.wwmcodes.workers.dev/v1/codes';

export const fetchYarCodes: CodesSource = async (lastCursor) => {
  const data = await fetchJSON<CodesResponse>(CODES_API_URL);

  const codes = data.active.filter((c) => c.verifiedAt);
  const latestCursor = codes[0].addedAt;

  if (!lastCursor) return { latestCursor, codes: [] };

  const newCodes = [];
  for (const code of codes) {
    if (code.addedAt == lastCursor) break;
    newCodes.push(code.code);
  }
  return { latestCursor, codes: newCodes };
};

interface CodeEntry {
  code: string;
  addedAt: string;
  expiredAt?: string;
  verifiedAt?: string;
}

interface CodesResponse {
  updatedAt: string;
  active: CodeEntry[];
  expired: CodeEntry[];
}
