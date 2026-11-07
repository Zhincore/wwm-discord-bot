import { CodesSource } from './source.js';

export const CODES_API_URL =
  'https://www.whereguildsmeet.org/api/redemption-codes';

export const fetchWGMCodes: CodesSource = async (lastCursor) => {
  const response = await fetch(CODES_API_URL);
  if (!response.ok)
    throw new Error(`WGM codes API returned ${response.status}`);

  const data: CodesResponse = await response.json();

  const codes = data.codes.filter((c) => c.reviewStatus == 'approved');
  const latestCursor = codes[0]?.createdAt ?? lastCursor ?? '';

  if (!lastCursor) return { latestCursor, codes: [] };

  return {
    latestCursor,
    codes: codes.filter((c) => c.createdAt > lastCursor).map((c) => c.code),
  };
};

interface CodeEntry {
  code: string;
  status: 'active' | 'expired';
  reviewStatus: 'pending' | 'approved';
  createdAt: string;
}

interface CodesResponse {
  codes: CodeEntry[];
}
