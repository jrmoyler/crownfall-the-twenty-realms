import type { Ability, AbilityKind, Civilization, CivilizationId, Family, Flavor, Palette, PassiveId, WeaponKind } from "./types";

const ab = (
  name: string,
  kind: AbilityKind,
  cooldown: number,
  power: number,
  radius: number,
  duration: number,
  count: number,
  note: string,
  flavor: Flavor = "none",
): Ability => ({ name, kind, cooldown, power, radius, duration, count, note, flavor });

const pal = (primary: string, glow: string, ground: string, metal: string, cloth: string): Palette =>
  ({ primary, glow, ground, metal, cloth });

interface Seed {
  index: number;
  id: CivilizationId;
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
  abilities: [Ability, Ability, Ability, Ability];
  passive: PassiveId;
  passiveText: string;
  difficulty: 1 | 2 | 3 | 4;
}

const rows: Seed[] = [
  {
    index: 1, id: "zenflow", name: "ZenFlow", ruler: "Asterion Vale", title: "Oracle-King",
    biome: "Astral Observatory", doctrine: "Foresight that arrives a heartbeat early.",
    lore: "Asterion keeps the last observatory clock wound. When it stops, the rivals are already inside the gate.",
    weaponName: "Chrono staff", weapon: "staff", elite: "Lattice Sentinels", family: "observatory",
    palette: pal("#7154e8", "#d7c6ff", "#141022", "#cfc6e4", "#2a2150"),
    abilities: [
      ab("Echo Lance", "lance", 4.2, 34, 0.3, 0, 1, "A line of delayed light that pierces the first rank."),
      ab("Probability Veil", "ward", 9, 22, 0, 1.3, 0, "Slip the next blow and mend what the future already spent."),
      ab("Lattice Call", "summon", 14, 11, 0, 12, 2, "Sentinels step out of a grid only you can see."),
      ab("Singularity", "meteor", 20, 78, 3.4, 0.85, 0, "A star folds onto the point you mark."),
    ],
    passive: "echo", passiveText: "After a phase-dodge, your next blows land heavier.", difficulty: 3,
  },
  {
    index: 2, id: "collective", name: "The Collective", ruler: "Caelum Rhys", title: "Sovereign Architect",
    biome: "Golden Basilica", doctrine: "Banners make a crowd into a wall.",
    lore: "Caelum does not raise his voice. The basilica does it for him, in gold leaf and locked shields.",
    weaponName: "Architect blade", weapon: "blade", elite: "Guild Phalanx", family: "basilica",
    palette: pal("#d5a638", "#ffe7a8", "#241c10", "#f0d48a", "#6a4a1c"),
    abilities: [
      ab("Golden Arc", "arc", 4.6, 32, 2.8, 0, 0, "A measured crescent. Anything inside it owes the crown."),
      ab("Rally Standard", "banner", 11, 8, 4.2, 7, 0, "Plant the standard. Inside it, the dynasty hits harder and mends."),
      ab("Citadel Guard", "summon", 13, 14, 0, 13, 3, "A short phalanx forms on your flank."),
      ab("Unified Dawn", "nova", 19, 64, 5.6, 0, 0, "The nave floods with morning. It is not gentle."),
    ],
    passive: "banner", passiveText: "One extra elite answers every summons.", difficulty: 2,
  },
  {
    index: 3, id: "hybrid-living", name: "Hybrid Living", ruler: "Liora Aven", title: "Scholar-Queen",
    biome: "Academy Terraces", doctrine: "The shield learns the shape of the last wound.",
    lore: "Liora grades her wars. Students who fail the terrace become the next lesson.",
    weaponName: "Scepter of lessons", weapon: "orb", elite: "Lore Wardens", family: "basilica",
    palette: pal("#4e8ce2", "#c5e4ff", "#101a2c", "#d5e6f7", "#1d3f6e"),
    abilities: [
      ab("Lesson Bolt", "lance", 3.8, 28, 0.28, 0, 1, "A precise correction. It prefers the nearest mistake."),
      ab("Adaptive Ward", "ward", 8.5, 18, 0, 1.1, 0, "A glass syllabus. You are briefly unreadable."),
      ab("Study Circle", "banner", 12, 6, 3.8, 8, 0, "Allies and ruler inside the circle recover their nerve."),
      ab("Graduation Ray", "volley", 18, 22, 0.24, 0, 5, "Five theses leave at once."),
    ],
    passive: "adapt", passiveText: "After you are struck, the next few seconds glance off.", difficulty: 2,
  },
  {
    index: 4, id: "nexus-labs", name: "Nexus Labs", ruler: "Rook Marcell", title: "Crimson Showmaster",
    biome: "Ember Amphitheater", doctrine: "If they are watching, the blow is already twice as large.",
    lore: "Rook burns the curtain on purpose. The applause is how he counts the dead.",
    weaponName: "Pyre baton", weapon: "staff", elite: "Stage Blades", family: "foundry",
    palette: pal("#bd423c", "#ffb0a4", "#2a1214", "#f0c2b4", "#5c1c22"),
    abilities: [
      ab("Flare Cut", "arc", 4.2, 30, 2.6, 0, 0, "A baton stroke that leaves the air embarrassed and on fire."),
      ab("Mirror Cast", "summon", 12, 10, 0, 9, 2, "Doubles take the stage and pick a fight."),
      ab("Encore Guard", "ward", 9, 16, 0, 1.2, 0, "The crowd refuses the next hit."),
      ab("Finale", "nova", 18, 70, 4.8, 0, 0, "House lights. Then none."),
    ],
    passive: "spectacle", passiveText: "Kills shave a little time off every rite.", difficulty: 3,
  },
  {
    index: 5, id: "terra-axis", name: "Terra Axis", ruler: "Sahra Kemet", title: "City Empress",
    biome: "Copper Citadel Ravines", doctrine: "The ground is a subject, not a setting.",
    lore: "Sahra surveys a city by deciding which streets are still allowed to exist.",
    weaponName: "Surveyor spear", weapon: "spear", elite: "Stone Surveyors", family: "monolith",
    palette: pal("#c4744a", "#ffd0b4", "#241612", "#e7c3a4", "#6a321c"),
    abilities: [
      ab("Survey Strike", "lance", 4, 32, 0.26, 0, 1, "A measured thrust with the reach of a street."),
      ab("Rampart Rise", "snare", 10, 8, 3.2, 4.5, 0, "Stone ribs out of the floor and keeps company there."),
      ab("Quake Mine", "mark", 13, 48, 3.4, 1.1, 0, "Mark the ground. It remembers, then disagrees."),
      ab("Axis Break", "nova", 19, 66, 5.2, 0, 0, "The ravine closes like a book."),
    ],
    passive: "rampart", passiveText: "A little of every blow is refused by your armor.", difficulty: 3,
  },
  {
    index: 6, id: "vital-helix", name: "Vital Helix", ruler: "Nami Seraph", title: "Gene-Seer",
    biome: "Healing Wetlands", doctrine: "Life is a thread. She chooses the knot.",
    lore: "Nami's marshes cure soldiers and then, politely, ask them to finish the war.",
    weaponName: "Helix staff", weapon: "staff", elite: "Helix Medics", family: "grove",
    palette: pal("#1b9e9a", "#b8fff0", "#0d2424", "#d4fff6", "#14524c"),
    abilities: [
      ab("Spore Dart", "lance", 3.6, 22, 0.26, 3, 1, "A soft dart. The poison is the honest part.", "poison"),
      ab("Mend Thread", "ward", 8, 28, 0, 0.4, 0, "Pull a stitch through your own ribs."),
      ab("Bloom Pod", "summon", 13, 9, 0, 12, 2, "Medics root where you stand and worry the flanks."),
      ab("Genome Storm", "nova", 18, 48, 4.6, 1, 0, "A wet green detonation that also closes your cuts."),
    ],
    passive: "mend", passiveText: "Out of the press, your body remembers how to close.", difficulty: 2,
  },
  {
    index: 7, id: "binary-loom", name: "Binary Loom", ruler: "Tarin Hex", title: "Code Regent",
    biome: "Circuit Gardens", doctrine: "Pain is a packet. He routes it.",
    lore: "Tarin grows gardens that compile. Trespassers are deprecated in public.",
    weaponName: "Loom glaive", weapon: "glaive", elite: "Loom Constructs", family: "observatory",
    palette: pal("#a8bb3d", "#eaff9a", "#161e0e", "#e4f2b0", "#3d4a16"),
    abilities: [
      ab("Bit Cleave", "arc", 4.4, 30, 2.9, 0, 0, "The glaive edits a wedge out of the rank."),
      ab("Link Shield", "ward", 9, 14, 0, 1.4, 0, "A checksum you can hide inside."),
      ab("Compile Golem", "summon", 14, 16, 0, 13, 1, "One heavy construct. It does not multitask."),
      ab("Zero Day", "chain", 16, 26, 8, 0, 4, "The fault jumps, then jumps again."),
    ],
    passive: "link", passiveText: "Chains find one more body than they should.", difficulty: 3,
  },
  {
    index: 8, id: "gaia-synthesis", name: "Gaia Synthesis", ruler: "Elder Briar", title: "Verdant Warden",
    biome: "Ancient Canopy Basin", doctrine: "Roots vote, and they vote to hold.",
    lore: "Briar has not left the basin in a century. The basin has left several times, wearing armies.",
    weaponName: "Thorn staff", weapon: "staff", elite: "Grove Guardians", family: "grove",
    palette: pal("#5e8f3d", "#d4f5a4", "#101c10", "#d7e8c4", "#243818"),
    abilities: [
      ab("Thorn Lash", "arc", 4, 28, 3.1, 0, 0, "The undergrowth takes a swing."),
      ab("Root Snare", "snare", 9.5, 10, 3.4, 4.2, 0, "Ankles become a local political issue."),
      ab("Grove Call", "summon", 14, 12, 0, 14, 2, "Guardians shoulder up through the loam."),
      ab("Verdant Reckoning", "nova", 19, 54, 5, 1, 0, "A green court. It fines everyone in range, then feeds you."),
    ],
    passive: "root", passiveText: "Snares drink longer. Foes who touch you bleed a little.", difficulty: 2,
  },
  {
    index: 9, id: "animus-prime", name: "Animus Prime", ruler: "Kairo-9", title: "Steel Titan",
    biome: "Cyan Forge Basin", doctrine: "Mass is a moral argument.",
    lore: "Kairo-9 was built to lift foundry gates. He kept the habit after the gates were people.",
    weaponName: "Ion hammer", weapon: "hammer", elite: "Prime Automata", family: "foundry",
    palette: pal("#25bdd5", "#c8fbff", "#0c2228", "#d8f7fb", "#145860"),
    abilities: [
      ab("Ion Slam", "arc", 5, 40, 3.2, 0, 0, "The hammer asks the ground to briefly become a wall."),
      ab("Magnet Ward", "snare", 10, 6, 3.6, 3.2, 0, "Pull the brave into the ugly middle.", "pull"),
      ab("Drone Spear", "summon", 13, 12, 0, 11, 2, "Two automata take the spacing you forgot."),
      ab("Prime Protocol", "meteor", 20, 86, 3.6, 0.7, 0, "A cylinder of forge-light. Stand elsewhere."),
    ],
    passive: "impact", passiveText: "Heavies land wider, as if the hammer resents precision.", difficulty: 4,
  },
  {
    index: 10, id: "aether-link", name: "Aether Link", ruler: "Ilyra Vox", title: "Signal Matriarch",
    biome: "Beacon Desert", doctrine: "Orders travel faster than horses, and hurt more.",
    lore: "Ilyra's beacons are temples that learned to gossip. The gossip is lightning.",
    weaponName: "Relay staff", weapon: "staff", elite: "Relay Riders", family: "monolith",
    palette: pal("#e0943e", "#ffe0ae", "#2a1a0e", "#f6d7b0", "#6a3e14"),
    abilities: [
      ab("Signal Chain", "chain", 5, 24, 9, 0, 3, "One word, several bodies."),
      ab("Phase Step", "dash", 6.5, 26, 1.3, 0, 0, "Be where the order already arrived."),
      ab("Beacon Call", "banner", 12, 7, 4, 7, 0, "A pillar of signal. Inside it you are louder."),
      ab("Skyline Burst", "volley", 16, 18, 0.22, 0, 6, "The horizon answers in sparks."),
    ],
    passive: "chain", passiveText: "Bolts and lances continue through the first body.", difficulty: 3,
  },
  {
    index: 11, id: "obsidian-arc", name: "Obsidian Arc", ruler: "Veyr Noct", title: "Black-Eye Warlord",
    biome: "Obsidian Breach Fortress", doctrine: "Fear is a formation, if you drill it.",
    lore: "Veyr does not besiege. He stands where the wall will wish it had been.",
    weaponName: "Shadow sabre", weapon: "blade", elite: "Arc Stalkers", family: "monolith",
    palette: pal("#a8325c", "#ffb3cc", "#1c0c14", "#f0c4d2", "#4c1830"),
    abilities: [
      ab("Night Cut", "dash", 5.5, 34, 1.4, 0, 0, "A step that arrives as a wound."),
      ab("Dread Veil", "snare", 10, 7, 3.8, 3.4, 0, "The brave reconsider their hobbies.", "pull"),
      ab("Stalker Pack", "summon", 13, 13, 0, 11, 3, "Three quiet problems."),
      ab("Black Sun", "nova", 20, 76, 5.4, 0, 0, "Noon, cancelled."),
    ],
    passive: "fear", passiveText: "Kills send the nearest rivals backward.", difficulty: 4,
  },
  {
    index: 12, id: "kinetic-edge", name: "Kinetic Edge", ruler: "Dax Merrow", title: "Arena Champion",
    biome: "Emerald Sun Arena", doctrine: "Speed is a debt collected on the next hit.",
    lore: "Dax has never lost a crowd. He has lost count of the people under it.",
    weaponName: "Momentum blades", weapon: "blade", elite: "Velocity Runners", family: "basilica",
    palette: pal("#79b84a", "#e7ffb8", "#142010", "#e4f5c8", "#2c5418"),
    abilities: [
      ab("Dash Cut", "dash", 4.8, 30, 1.35, 0, 0, "The blades go first. You catch up inside them."),
      ab("Parry Pulse", "ward", 8, 10, 2.4, 1.1, 0, "A perfect small no, then a shock."),
      ab("Runner Surge", "banner", 11, 4, 3.2, 6, 0, "Everyone in the ring is late except you.", "haste"),
      ab("Overdrive", "arc", 15, 58, 3.6, 0, 0, "Three steps of arena, taken at once."),
    ],
    passive: "momentum", passiveText: "Staying in motion sharpens the next blow.", difficulty: 3,
  },
  {
    index: 13, id: "civic-core", name: "Civic Core", ruler: "Amara Sol", title: "Dove Emissary",
    biome: "Rose Civic Gardens", doctrine: "Protection is a weapon with better manners.",
    lore: "Amara still sends envoys. They return as walls of rose marble and unreasonable calm.",
    weaponName: "Harmony mace", weapon: "hammer", elite: "Peacekeepers", family: "grove",
    palette: pal("#c4849e", "#ffd6e6", "#24141c", "#f6d5e2", "#6a3048"),
    abilities: [
      ab("Peace Wave", "nova", 7, 22, 4.2, 1, 0, "A soft ring that heals you and shoves the rest."),
      ab("Safe Haven", "ward", 9, 20, 0, 1.5, 0, "The garden declines your injury."),
      ab("Civic Rally", "summon", 13, 11, 0, 13, 2, "Peacekeepers, who define peace narrowly."),
      ab("Common Light", "banner", 16, 9, 4.6, 8, 0, "A civic oath. Inside it, harm is shared and lessened."),
    ],
    passive: "aegis", passiveText: "Shrines attune faster. Wards linger.", difficulty: 1,
  },
  {
    index: 14, id: "quantum-ledger", name: "Quantum Ledger", ruler: "Marius Quill", title: "Balance Magister",
    biome: "Silver Vault Catacombs", doctrine: "Every wound is a debt with interest.",
    lore: "Marius keeps two books. One is law. The other is whoever is still standing.",
    weaponName: "Scale sceptre", weapon: "orb", elite: "Ledger Wardens", family: "monolith",
    palette: pal("#b7b6c2", "#f4f2ff", "#1a1a20", "#e6e4ee", "#3a3a46"),
    abilities: [
      ab("Debit Ray", "lance", 4, 26, 0.26, 0, 1, "A thin silver invoice."),
      ab("Audit Shield", "ward", 9, 16, 0, 1.3, 0, "The books close over you."),
      ab("Balance Guard", "summon", 14, 13, 0, 12, 2, "Wardens arrive to witness, then to collect."),
      ab("Market Collapse", "meteor", 18, 74, 3.8, 0.75, 0, "A vault falls out of the price of the air."),
    ],
    passive: "debt", passiveText: "Branded foes take more from every later blow.", difficulty: 3,
  },
  {
    index: 15, id: "signal-velocity", name: "Signal Velocity", ruler: "Vera Pyre", title: "Flame Herald",
    biome: "Scarlet Signal Mesas", doctrine: "A critical moment should spread.",
    lore: "Vera broadcasts from the mesa lip. The message is fire, and it trends.",
    weaponName: "Broadcast lance", weapon: "spear", elite: "Broadcast Raiders", family: "foundry",
    palette: pal("#e15a52", "#ffc2ba", "#2a1212", "#f8d0c8", "#6e2420"),
    abilities: [
      ab("Pulse Shot", "volley", 5, 16, 0.22, 0, 4, "Four notes, all of them sharp."),
      ab("Hype Field", "banner", 11, 6, 4, 6.5, 0, "The mesa leans in. So do your blows.", "haste"),
      ab("Flash Mob", "summon", 13, 11, 0, 10, 3, "Raiders arrive already mid-sentence."),
      ab("Viral Inferno", "chain", 16, 28, 8.5, 0, 5, "It was only going to hit one of them."),
    ],
    passive: "tempo", passiveText: "Your hand favors the cruel timing of a critical blow.", difficulty: 3,
  },
  {
    index: 16, id: "juris-guard", name: "Juris Guard", ruler: "Aurelius Kane", title: "Ivory Justiciar",
    biome: "Marble Tribunal Ruins", doctrine: "A verdict is a kind of weather.",
    lore: "Aurelius still opens court at dawn. The defendants are whoever crossed the marble.",
    weaponName: "Oath blade", weapon: "blade", elite: "Oath Knights", family: "basilica",
    palette: pal("#e6d7bc", "#fff6e4", "#221e18", "#f7efe2", "#6c5c48"),
    abilities: [
      ab("Verdict", "lance", 4.2, 33, 0.28, 0, 1, "One clean sentence with an edge."),
      ab("Oath Wall", "snare", 10, 9, 3.3, 4, 0, "A pale barrier that objects to movement."),
      ab("Knight Order", "summon", 14, 15, 0, 13, 2, "Two knights who have read the relevant statute."),
      ab("Final Appeal", "nova", 19, 62, 5, 0, 0, "The gallery rises. It is not symbolic."),
    ],
    passive: "judgment", passiveText: "Calling your elite costs less command.", difficulty: 2,
  },
  {
    index: 17, id: "cognara-mind", name: "Cognara Mind", ruler: "Mira Nyx", title: "Mindweaver",
    biome: "Memory Forest", doctrine: "They swing at the version of you she prefers.",
    lore: "Mira keeps other people's worst memories on leashes and walks them at dusk.",
    weaponName: "Thought rod", weapon: "orb", elite: "Thought Scribes", family: "grove",
    palette: pal("#b24d72", "#ffc0da", "#241018", "#f4d0e0", "#5c2038"),
    abilities: [
      ab("Mind Spike", "lance", 3.8, 30, 0.26, 0, 1, "A thought with the manners of a nail."),
      ab("Fear Mirror", "ward", 9, 12, 0, 1.6, 0, "The next moment glances off and glares back.", "reflect"),
      ab("Scribe Chorus", "summon", 13, 10, 0, 12, 3, "Scribes write your enemies into smaller people."),
      ab("Ego Eclipse", "mark", 17, 58, 4.2, 1.15, 0, "Name them. The name detonates."),
    ],
    passive: "mirror", passiveText: "Some hostile sparks decide they were yours.", difficulty: 4,
  },
  {
    index: 18, id: "vector-shift", name: "Vector Shift", ruler: "Bramm Iron", title: "Iron Marshal",
    biome: "Storm Foundry Plateau", doctrine: "Artillery is just patience with a fuse.",
    lore: "Bramm lost the plateau twice and bought it back with falling metal.",
    weaponName: "Forge maul", weapon: "hammer", elite: "Forge Breakers", family: "foundry",
    palette: pal("#a78470", "#ffd7c2", "#241814", "#f0d2c4", "#5c4034"),
    abilities: [
      ab("Impact Blow", "arc", 4.8, 38, 2.9, 0, 0, "The maul does not discuss."),
      ab("Iron Skin", "ward", 10, 18, 0, 1.6, 0, "For a breath you are inventory, not a target."),
      ab("Battery Line", "volley", 12, 20, 0.24, 0, 5, "Five apologies from the plateau."),
      ab("Foundry Fall", "meteor", 18, 84, 4, 0.8, 0, "Something industrial remembers gravity."),
    ],
    passive: "artillery", passiveText: "Meteors and volleys hit like they were aimed by a guild.", difficulty: 4,
  },
  {
    index: 19, id: "nomad-nexus", name: "Nomad Nexus", ruler: "Sef Kadar", title: "Horizon Cartographer",
    biome: "Caravan Sea", doctrine: "The map is only true while you are moving.",
    lore: "Sef sells routes to both sides and then takes the third, which he did not draw.",
    weaponName: "Compass scimitar", weapon: "blade", elite: "Dune Rovers", family: "monolith",
    palette: pal("#c49a58", "#ffe6b4", "#24180e", "#f4e0bc", "#6a4c22"),
    abilities: [
      ab("Compass Cut", "dash", 4.6, 28, 1.3, 0, 0, "A heading, then a scar."),
      ab("Caravan Dash", "dash", 7.5, 22, 1.5, 0, 0, "Longer. The dunes agree to be elsewhere."),
      ab("Scout Circle", "summon", 12, 10, 0, 11, 3, "Rovers circle the problem until it is smaller."),
      ab("Horizon Storm", "nova", 17, 60, 5.5, 0, 0, "The whole distance arrives at once."),
    ],
    passive: "path", passiveText: "The caravan pace. You are simply quicker.", difficulty: 2,
  },
  {
    index: 20, id: "eon-core", name: "Eon Core", ruler: "Orun Aeon", title: "Chronarch Elder",
    biome: "Infinity Ruins", doctrine: "Strike now. Let it land when it matters.",
    lore: "Orun buried his first crown in these ruins so the second would have something to outlive.",
    weaponName: "Epoch staff", weapon: "staff", elite: "Epoch Keepers", family: "observatory",
    palette: pal("#cbb98a", "#fff3c8", "#221e12", "#f3e8c4", "#5c5230"),
    abilities: [
      ab("Epoch Mark", "mark", 6, 46, 3.2, 1.35, 0, "Touch the moment. Collect it shortly."),
      ab("Stillness Ward", "ward", 10, 20, 0, 1.8, 0, "Time declines to include you."),
      ab("Keeper Call", "summon", 14, 13, 0, 14, 2, "Keepers who have already finished this fight once."),
      ab("Last Horizon", "meteor", 21, 96, 4.2, 1.05, 0, "The longest fuse in the atlas."),
    ],
    passive: "delay", passiveText: "Marked detonations settle heavier.", difficulty: 4,
  },
];

export const CIVILIZATIONS: readonly Civilization[] = rows;

export const byId = (id: CivilizationId) => CIVILIZATIONS.find((c) => c.id === id) ?? CIVILIZATIONS[1]!;

export const byIndex = (index: number) => CIVILIZATIONS[index] ?? CIVILIZATIONS[0]!;

/** Hand-set atlas, outer ring then inner courts. Percent of the war table. */
export const ATLAS: readonly [number, number][] = [
  [50, 12], [66, 16], [79, 28], [84, 44], [76, 60], [62, 72],
  [46, 76], [30, 70], [18, 56], [14, 40], [22, 24], [36, 14],
  [42, 36], [58, 34], [66, 48], [58, 60], [44, 62], [34, 50],
  [40, 46], [52, 48],
];

const EDGES: readonly [number, number][] = (() => {
  const edges: [number, number][] = [];
  for (let i = 0; i < 12; i += 1) edges.push([i, (i + 1) % 12]);
  for (let i = 0; i < 8; i += 1) {
    edges.push([12 + i, 12 + ((i + 1) % 8)]);
    edges.push([12 + i, (i * 2) % 12]);
  }
  return edges;
})();

export function neighborIndexes(index: number): number[] {
  const set = new Set<number>();
  for (const [a, b] of EDGES) {
    if (a === index) set.add(b);
    if (b === index) set.add(a);
  }
  return [...set];
}

export function sigilPaths(index: number): string {
  const marks = [
    "M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z",
    "M12 3 A9 9 0 1 0 12 21 A9 9 0 1 0 12 3 M12 7 A5 5 0 1 1 12 17 A5 5 0 1 1 12 7",
    "M4 18 L12 4 L20 18 Z M8 18 L12 11 L16 18",
    "M12 3 L13.5 9.5 L20 8 L15 13 L17 20 L12 16 L7 20 L9 13 L4 8 L10.5 9.5 Z",
    "M5 5 H19 V19 H5 Z M8 8 H16 V16 H8 Z",
    "M12 3 L20 12 L12 21 L4 12 Z M12 8 L16 12 L12 16 L8 12 Z",
    "M12 3 L19 8 L19 16 L12 21 L5 16 L5 8 Z",
    "M12 4 C16 8 16 8 20 12 C16 16 16 16 12 20 C8 16 8 16 4 12 C8 8 8 8 12 4 Z",
    "M12 3 V21 M3 12 H21 M6 6 L18 18 M18 6 L6 18",
    "M4 14 C8 6 16 6 20 14 C16 12 8 12 4 14 M8 16 H16",
    "M12 3 L15 12 L12 21 L9 12 Z M4 12 H20",
    "M6 18 L12 4 L18 18 M9 13 H15",
    "M5 12 H19 M12 5 V19 M7 7 L17 17 M17 7 L7 17",
    "M4 8 H20 V16 H4 Z M8 8 V16 M16 8 V16",
    "M4 16 L12 4 L20 16 L12 13 Z",
    "M6 4 H18 V8 H14 V20 H10 V8 H6 Z",
    "M12 4 C18 8 18 16 12 20 C6 16 6 8 12 4 M12 8 V16",
    "M5 6 H19 L12 20 Z M8 10 H16",
    "M4 12 H20 M8 6 L12 18 L16 6",
    "M12 4 A8 8 0 1 0 12.01 4 M12 8 A4 4 0 1 0 12.01 8",
  ];
  return marks[(index - 1) % marks.length] ?? marks[0]!;
}
