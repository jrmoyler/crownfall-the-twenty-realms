export type CivilizationId =
  | "zenflow" | "collective" | "hybrid-living" | "nexus-labs" | "terra-axis"
  | "vital-helix" | "binary-loom" | "gaia-synthesis" | "animus-prime" | "aether-link"
  | "obsidian-arc" | "kinetic-edge" | "civic-core" | "quantum-ledger" | "signal-velocity"
  | "juris-guard" | "cognara-mind" | "vector-shift" | "nomad-nexus" | "eon-core";

export type WeaponKind = "staff" | "blade" | "hammer" | "spear" | "glaive" | "orb";
export type Family = "observatory" | "basilica" | "foundry" | "grove" | "monolith";
export type AbilityKind =
  | "lance" | "arc" | "nova" | "ward" | "snare" | "chain"
  | "summon" | "mark" | "dash" | "meteor" | "banner" | "volley";
export type Flavor = "none" | "pull" | "poison" | "reflect" | "haste";
export type PassiveId =
  | "echo" | "banner" | "adapt" | "spectacle" | "rampart" | "mend" | "link" | "root"
  | "impact" | "chain" | "fear" | "momentum" | "aegis" | "debt" | "tempo" | "judgment"
  | "mirror" | "artillery" | "path" | "delay";
export type EnemyRole = "vanguard" | "skirmisher" | "brute" | "mystic";
export type Mode = "campaign" | "survival";

export interface Ability {
  name: string;
  kind: AbilityKind;
  cooldown: number;
  power: number;
  radius: number;
  duration: number;
  count: number;
  note: string;
  flavor: Flavor;
}

export interface Palette {
  primary: string;
  glow: string;
  ground: string;
  metal: string;
  cloth: string;
}

export interface Civilization {
  id: CivilizationId;
  index: number;
  name: string;
  ruler: string;
  title: string;
  biome: string;
  doctrine: string;
  lore: string;
  weaponName: string;
  weapon: WeaponKind;
  elite: string;
  family: Family;
  palette: Palette;
  abilities: readonly [Ability, Ability, Ability, Ability];
  passive: PassiveId;
  passiveText: string;
  difficulty: 1 | 2 | 3 | 4;
}

export interface RelicDef {
  id: string;
  name: string;
  text: string;
  rare: boolean;
}

export interface Seals {
  vitality: number;
  edge: number;
  wind: number;
  reliquary: number;
  oath: number;
}

export interface SaveData {
  version: 2;
  muted: boolean;
  reducedMotion: boolean;
  selected: CivilizationId;
  best: Record<string, number>;
  cleared: string[];
  shards: number;
  seals: Seals;
  tutorialSeen: boolean;
}

export interface RunResult {
  victory: boolean;
  mode: Mode;
  wave: number;
  kills: number;
  score: number;
  shrine: number;
  shards: number;
  rivalName: string;
}

export interface HudState {
  hp: number;
  hpMax: number;
  stamina: number;
  command: number;
  shrine: number;
  wave: number;
  kills: number;
  score: number;
  multiplier: number;
  objective: string;
  threat: string;
  hostiles: number;
  bossName: string;
  bossHp: number;
  bossMax: number;
  cooldowns: readonly number[];
  cooldownMax: readonly number[];
  low: boolean;
  banner: string;
  feed: readonly string[];
}
