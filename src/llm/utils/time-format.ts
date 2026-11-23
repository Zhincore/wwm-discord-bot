const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Distance from `now` in the largest fitting unit, e.g. "in 5 h", "3 d ago", "now". */
export function formatRelative(ms: number, now = Date.now()): string {
  const diff = ms - now;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return 'now';
  const amount =
    abs < HOUR
      ? `${Math.round(abs / MINUTE)} min`
      : abs < 2 * DAY
        ? `${Math.round(abs / HOUR)} h`
        : `${Math.round(abs / DAY)} d`;
  return diff > 0 ? `in ${amount}` : `${amount} ago`;
}

/**
 * Unix seconds as Discord date-time and relative tags, plus a note only the model reads,
 * e.g. "<t:1795000000:f> (<t:1795000000:R>) [note: in 5 h]".
 */
export function formatTime(seconds: number, now = Date.now()): string {
  const whole = Math.round(seconds);
  return `<t:${whole}:f> (<t:${whole}:R>) [note: ${formatRelative(whole * 1000, now)}]`;
}

/** Unix seconds as a Discord time-of-day tag, e.g. "<t:1795000000:t>". */
export function formatClock(seconds: number): string {
  return `<t:${Math.round(seconds)}:t>`;
}
