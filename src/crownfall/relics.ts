import type { RelicDef } from "./types";

export const RELICS: readonly RelicDef[] = [
  { id: "honed", name: "Honed Oath", text: "Every strike cuts 14% deeper.", rare: false },
  { id: "leech", name: "Red Reliquary", text: "A portion of harm returns as blood.", rare: false },
  { id: "quicksilver", name: "Quicksilver Vows", text: "You move lighter. Rites recover sooner.", rare: false },
  { id: "splinter", name: "Splinter Shot", text: "Basic attacks loose an extra seeking shard.", rare: false },
  { id: "bulwark", name: "Bulwark Seal", text: "More vitality, and thorns for anyone who closes.", rare: false },
  { id: "shrineheart", name: "Shrineheart", text: "Shrines and wells answer faster. You mend beside them.", rare: false },
  { id: "command", name: "War Table", text: "Elites linger, and one more answers the call.", rare: false },
  { id: "omen", name: "Open Omen", text: "Critical blows land more often and harder.", rare: false },
  { id: "wide", name: "Wide Heaven", text: "Zones, arcs and meteors cover more ground.", rare: false },
  { id: "secondwind", name: "Second Wind", text: "Dodge recovers faster. Stamina returns eager.", rare: false },
  { id: "glass", name: "Glass Coronet", text: "Ruinous power. The crown sits thinner.", rare: false },
  { id: "standard", name: "Living Standard", text: "Banners and wards hold longer and bite harder.", rare: false },
  { id: "eclipse", name: "Pocket Eclipse", text: "Every few heartbeats the sky falls on its own.", rare: true },
  { id: "twin", name: "Twin Host", text: "Summons arrive with a second and stay longer.", rare: true },
  { id: "crown-debt", name: "Crown Debt", text: "Your blows brand foes. Brands burst early.", rare: true },
];

export const relicById = (id: string) => RELICS.find((relic) => relic.id === id);

const commons = RELICS.filter((relic) => !relic.rare);
const rares = RELICS.filter((relic) => relic.rare);

export function draftOptions(owned: Record<string, number>, rng: () => number, bonus: number): RelicDef[] {
  const cap = (relic: RelicDef) => (relic.rare ? 1 : 3);
  const pool = (list: RelicDef[]) => list.filter((relic) => (owned[relic.id] ?? 0) < cap(relic));
  const pick = (list: RelicDef[], taken: Set<string>) => {
    const open = list.filter((relic) => !taken.has(relic.id));
    const source = open.length ? open : list;
    if (!source.length) return null;
    const relic = source[Math.floor(rng() * source.length)]!;
    taken.add(relic.id);
    return relic;
  };
  const taken = new Set<string>();
  const options: RelicDef[] = [];
  const rare = pick(pool(rares), taken);
  if (rare) options.push(rare);
  const count = 3 + Math.max(0, bonus);
  while (options.length < count) {
    const next = pick(pool(commons).concat(pool(rares)), taken);
    if (!next) break;
    options.push(next);
  }
  for (let i = options.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = options[i]!;
    options[i] = options[j]!;
    options[j] = swap;
  }
  return options.slice(0, count);
}
