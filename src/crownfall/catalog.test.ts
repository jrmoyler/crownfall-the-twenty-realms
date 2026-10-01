import { describe, expect, it } from "vitest";
import { CIVILIZATIONS, neighborIndexes } from "./catalog";

describe("the twenty realms", () => {
  it("keeps twenty distinct, fully armed civilizations", () => {
    expect(CIVILIZATIONS).toHaveLength(20);
    expect(new Set(CIVILIZATIONS.map((civ) => civ.id)).size).toBe(20);
    for (const civ of CIVILIZATIONS) {
      expect(civ.abilities).toHaveLength(4);
      expect(civ.lore.length).toBeGreaterThan(20);
      expect(neighborIndexes(civ.index - 1).length).toBeGreaterThan(0);
    }
  });
});
