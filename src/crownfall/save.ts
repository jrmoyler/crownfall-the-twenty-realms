import type { CivilizationId, SaveData, Seals } from "./types";

const KEY = "crownfall-chronicle-v2";

export const emptySeals = (): Seals => ({ vitality: 0, edge: 0, wind: 0, reliquary: 0, oath: 0 });

const empty = (): SaveData => ({
  version: 2,
  muted: false,
  reducedMotion: false,
  selected: "collective",
  best: {},
  cleared: [],
  shards: 0,
  seals: emptySeals(),
  tutorialSeen: false,
});

export function loadSave(): SaveData {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<SaveData>;
    return {
      ...empty(),
      ...raw,
      version: 2,
      best: raw.best ?? {},
      cleared: Array.isArray(raw.cleared) ? raw.cleared : [],
      seals: { ...emptySeals(), ...(raw.seals ?? {}) },
    };
  } catch {
    return empty();
  }
}

export function writeSave(save: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode: the chronicle lives for this sitting only */
  }
}

export const clearKey = (ruler: CivilizationId, rival: CivilizationId) => `${ruler}>${rival}`;

export const SEAL_COST = [0, 40, 90, 160] as const;

export function sealRankCost(rank: number): number | null {
  if (rank >= 3) return null;
  return SEAL_COST[rank + 1] ?? null;
}
