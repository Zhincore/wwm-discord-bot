const e = (key: string) => process.env[key]?.trim();

export const GUILD_NAME = e('GUILD_NAME');
export const PROXY_NAME = e('PROXY_NAME');

export const DATA_DIR = '.data';

export const CODES_API_URL =
  'https://codes-backend.wwmcodes.workers.dev/v1/codes';

/** Models to answer with, in order of preference; later ones are fallbacks when an earlier one fails. */
export const LLM_MODELS = (e('LLM_MODEL') || 'openrouter/free')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
