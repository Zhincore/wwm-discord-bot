export const mastery = (num: number) =>
  Math.round(num).toLocaleString(undefined, { maximumFractionDigits: 0 }) +
  ` (${(num / 10_000).toLocaleString()} goose)`;
