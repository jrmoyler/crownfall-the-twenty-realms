// Every third-party asset the game ships, with where it came from and its licence.
// `npm run assets` rebuilds public/realm from these sources. CREDITS.md is generated from this list.

const objaverse = (uid, path) => ({ kind: "objaverse", uid, path });

// Characters: rigged, textured humanoids (Sketchfab via Objaverse, CC BY 4.0).
// `tris` is the triangle budget after simplification, `tex` the texture edge in pixels.
export const CHARACTERS = {
  ruler_basilica: { ...objaverse("4e61da8bb7f3440db3df42ee26c4b797", "glbs/000-156/4e61da8bb7f3440db3df42ee26c4b797.glb"), title: "Overlord", author: "DJMaesen", license: "CC BY 4.0", tris: 16000, tex: 1024 },
  ruler_foundry: { ...objaverse("5b91e9ec25a14a6da18b4ca8e238e496", "glbs/000-043/5b91e9ec25a14a6da18b4ca8e238e496.glb"), title: "Heimjil", author: "antoinepavia", license: "CC BY 4.0", tris: 22000, tex: 1024 },
  ruler_monolith: { ...objaverse("a3f7b44275cf4c489ad62c535268ac16", "glbs/000-010/a3f7b44275cf4c489ad62c535268ac16.glb"), title: "Skeleton Lord", author: "DJMaesen", license: "CC BY 4.0", tris: 16000, tex: 1024 },
  ruler_observatory: { ...objaverse("566d1224b48e4765acad9593bd9637b8", "glbs/000-086/566d1224b48e4765acad9593bd9637b8.glb"), title: "Solus The Knight", author: "manoeldarochadeoliveira", license: "CC BY 4.0", tris: 16000, tex: 1024 },
  ruler_grove: { ...objaverse("8c74109a7526427ebcc2ffae03c5d986", "glbs/000-130/8c74109a7526427ebcc2ffae03c5d986.glb"), title: "Taqa the hunter: AS3 - Organic Character", author: "Artise1", license: "CC BY 4.0", tris: 20000, tex: 1024, drop: "Ground|Fern|Plane|Foilage" },
  soldier: { ...objaverse("98a655cb943d41d68974848ac2409559", "glbs/000-152/98a655cb943d41d68974848ac2409559.glb"), title: "knight of the blood order", author: "DJMaesen", license: "CC BY 4.0", tris: 8000, tex: 512 },
  skirmisher: { ...objaverse("8d425dd024474101bca68e960f910319", "glbs/000-154/8d425dd024474101bca68e960f910319.glb"), title: "Goblin assassin", author: "Sergey Egelsky", license: "CC BY 4.0", tris: 9000, tex: 512 },
  brute: { ...objaverse("2ff3458809da4f3d867a9edfc3ee5f43", "glbs/000-082/2ff3458809da4f3d867a9edfc3ee5f43.glb"), title: "DOOM - Hell Knight -", author: "nataliedesign", license: "CC BY 4.0", tris: 12000, tex: 512 },
  mystic: { ...objaverse("24931c7aec9143919c64eedaaa498b69", "glbs/000-047/24931c7aec9143919c64eedaaa498b69.glb"), title: "Kalimsher the lich", author: "antoinepavia", license: "CC BY 4.0", tris: 9000, tex: 512 },
  ally: { ...objaverse("9d912e0fedb44b619fbd2a083bbf174f", "glbs/000-140/9d912e0fedb44b619fbd2a083bbf174f.glb"), title: "Strong Knight", author: "DJMaesen", license: "CC BY 4.0", tris: 8000, tex: 512 },
};

export const WEAPONS = {
  blade: { ...objaverse("b2662f2666a844e8a1bd0e7c4a7672d8", "glbs/000-005/b2662f2666a844e8a1bd0e7c4a7672d8.glb"), title: "Chevalier Sword", author: "rubenve", license: "CC BY 4.0", tris: 2500, tex: 512 },
  staff: { ...objaverse("0dfda2514e4849cdb60b153808b5f65c", "glbs/000-101/0dfda2514e4849cdb60b153808b5f65c.glb"), title: "Skull Staff", author: "Devin Eggleston", license: "CC BY 4.0", tris: 3000, tex: 512 },
  spear: { ...objaverse("f61070945153418fa11c4abae286b292", "glbs/000-034/f61070945153418fa11c4abae286b292.glb"), title: "Medieval Spear", author: "iedalton", license: "CC BY 4.0", tris: 2000, tex: 512 },
  hammer: { kind: "polyhaven", id: "ornate_war_hammer", title: "Ornate War Hammer", author: "Poly Haven", license: "CC0", tris: 3000, tex: 512 },
  glaive: { ...objaverse("f9f1f025112648fb9557cb789e3d0074", "glbs/000-041/f9f1f025112648fb9557cb789e3d0074.glb"), title: "Darksiders: Scythe of Death", author: "Mostafa Rashad", license: "CC BY 4.0", tris: 2500, tex: 512 },
  orb: { ...objaverse("6f30b84e8f4c414fa1214d9b1d1a4e13", "glbs/000-141/6f30b84e8f4c414fa1214d9b1d1a4e13.glb"), title: "Urfin Juice golden scepter", author: "gorbovski", license: "CC BY 4.0", tris: 3000, tex: 512 },
};

// Photoscanned environment pieces from Poly Haven (CC0).
export const PROPS = {
  fir_tree_01: 9000, rock_moss_set_01: 6000, rock_moss_set_02: 6000, tree_stump_01: 3000,
  root_cluster_01: 3000, fern_02: 2500, dead_tree_trunk: 4000, shrub_01: 3000,
  gothic_statue: 6000, horse_statue_01: 6000, stone_fire_pit: 4000,
  namaqualand_boulder_02: 3000, namaqualand_boulder_04: 3000, namaqualand_boulder_05: 3000,
  dead_tree_trunk_02: 4000, cannon_01: 4000, wooden_barrels_01: 3000,
  moon_rock_01: 3000, moon_rock_03: 3000, moon_rock_05: 3000, coast_rocks_01: 5000, rock_face_01: 6000,
  namaqualand_cliff_01: 6000, quiver_tree_01: 7000, dead_quiver_trunk: 4000, sand_rocks_small_01: 3000, rock_07: 3000,
};

// Ground surfaces per family: a base layer and a blend layer, plus the sky light.
export const REALMS = {
  grove: { ground: "forest_floor", blend: "mossy_rock", hdri: "forest_slope" },
  basilica: { ground: "cobblestone_floor_04", blend: "sparse_grass", hdri: "kloofendal_48d_partly_cloudy" },
  foundry: { ground: "burned_ground_01", blend: "cracked_red_ground", hdri: "industrial_sunset_02" },
  observatory: { ground: "snow_02", blend: "rock_ground", hdri: "kloofendal_misty_morning" },
  monolith: { ground: "aerial_sand", blend: "dry_ground_rocks", hdri: "goegap" },
};
