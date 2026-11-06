/**
 * Remembers how tall the user made each big text box, in this browser.
 * One entry per kind of field (for example "Notes"), not per record, so storage stays tiny.
 */
const STORAGE_KEY = "creatoros-field-heights";
const MIN = 48;
const MAX = 4000;
const MAX_FIELDS = 60;

type Sizes = Record<string, number>;

function readAll(): Sizes {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as unknown;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const out: Sizes = {};
    for (const [k, v] of Object.entries(raw)) if (typeof v === "number" && v >= MIN && v <= MAX) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export function getFieldHeight(key: string): number | null {
  return readAll()[key] ?? null;
}

export function saveFieldHeight(key: string, height: number) {
  if (!key || !Number.isFinite(height) || height < MIN || height > MAX) return;
  try {
    const sizes = readAll();
    const rounded = Math.round(height);
    if (sizes[key] === rounded) return;
    delete sizes[key]; // re-insert last so the oldest entries are the ones dropped
    sizes[key] = rounded;
    const keys = Object.keys(sizes);
    for (const old of keys.slice(0, Math.max(0, keys.length - MAX_FIELDS))) delete sizes[old];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
  } catch {
    /* Private mode or full storage: the box simply forgets its size. */
  }
}
