import { describe, expect, it } from 'vitest';
import { CIVILIZATIONS } from './catalog';

describe('civilization catalog', () => {
  it('exposes exactly the twenty active civilizations', () => {
    expect(CIVILIZATIONS).toHaveLength(20);
    expect(new Set(CIVILIZATIONS.map((item) => item.id)).size).toBe(20);
    expect(CIVILIZATIONS.some((item) => /Astral Forge|Materia Nova|Aqua Meridian/.test(item.name))).toBe(false);
  });

  it('gives every civilization a distinct biome seed and four abilities', () => {
    expect(new Set(CIVILIZATIONS.map((item) => item.seed)).size).toBe(20);
    expect(CIVILIZATIONS.every((item) => item.abilities.length === 4)).toBe(true);
  });
});
