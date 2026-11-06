/** "4h 10m", "0h 45m". */
export function formatMinutes(total: number) {
  const minutes = Math.max(0, Math.round(total));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/**
 * Reads what the creator typed as a duration: "90", "1.5h", "2h 15m", "45m".
 * Bare numbers are minutes. Returns null when it can't tell.
 */
export function parseDuration(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (!text) return 0;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text));
  const match = /^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:ute)?s?)?)?$/.exec(text);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;
  return Math.round(Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0));
}
