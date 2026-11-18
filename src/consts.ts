const e = (key: string) => process.env[key]?.trim();

export const GUILD_NAME = e('GUILD_NAME');

export const DATA_DIR = '.data';

export const CODES_API_URL =
  'https://codes-backend.wwmcodes.workers.dev/v1/codes';

export const LLM_MODEL = e('LLM_MODEL') || 'openrouter/free';
export const LLM_CONTEXT = e('LLM_CONTEXT');
