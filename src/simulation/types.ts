export type CivilizationId =
  | 'zenflow' | 'collective' | 'hybrid-living' | 'nexus-labs' | 'terra-axis'
  | 'vital-helix' | 'binary-loom' | 'gaia-synthesis' | 'animus-prime' | 'aether-link'
  | 'obsidian-arc' | 'kinetic-edge' | 'civic-core' | 'quantum-ledger' | 'signal-velocity'
  | 'juris-guard' | 'cognara-mind' | 'vector-shift' | 'nomad-nexus' | 'eon-core';

export interface Civilization {
  id: CivilizationId;
  index: number;
  name: string;
  ruler: string;
  title: string;
  palette: { primary: string; glow: string; ground: string; accent: string };
  biome: string;
  doctrine: string;
  weapon: string;
  elite: string;
  enemy: string;
  abilities: readonly [string, string, string, string];
  seed: number;
  difficulty: number;
}
