import { fetchJSON } from '#common/utils.js';

import { CodesSource } from './source.js';

export const CODES_API_URL =
  'https://codes-backend-prod.wwmcodes.workers.dev/v1/codes';

export const fetchYarCodes: CodesSource = async (lastCursor) => {
  const data = await fetchJSON<CodesResponse>(CODES_API_URL);

  const codes = data.active.filter((c) => c.verifiedAt);
  const latestCursor = codes[0]?.addedAt ?? lastCursor ?? '';

  // Skip first fetch
  if (!lastCursor) return { latestCursor, codes: [] };

  return {
    latestCursor,
    codes: codes.filter((c) => c.addedAt > lastCursor).map((c) => c.code),
  };
};

interface CodeEntry {
  code: string;
  addedAt: string;
  tags: string[];
  expiresAt: string | null;
  expiredAt?: string;
  verifiedAt: string | null;
}

interface CodesResponse {
  updatedAt: string;
  active: CodeEntry[];
  expired: CodeEntry[];
  announcement: object | null;
  maintenance: { active: boolean; notice: string | null };
}
