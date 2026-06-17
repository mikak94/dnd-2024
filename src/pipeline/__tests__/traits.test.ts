import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { TraitSchema } from '../schemas/trait-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors spells.test.ts. Skipped until `npm run validate trait` produces
 * data/out/5e-SRD-Traits.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Traits.json');

describe.skipIf(!existsSync(file))('2024 traits', () => {
  // Guarded so the describe body doesn't throw during collection when skipped.
  const traits = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as unknown[])
    : [];

  it('has records (did you run the pipeline?)', () => {
    expect(traits.length).toBeGreaterThan(0);
  });

  it('every trait matches TraitSchema', () => {
    for (const trait of traits) {
      const result = TraitSchema.safeParse(trait);
      const id = (trait as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = traits.map((t) => (t as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('every trait belongs to at least one species or subspecies', () => {
    for (const trait of traits) {
      const t = trait as {
        index: string;
        species: unknown[];
        subspecies: unknown[];
      };
      expect(
        t.species.length + t.subspecies.length,
        `${t.index} has no species/subspecies`,
      ).toBeGreaterThan(0);
    }
  });

  // A species whose lineage is modeled as subspecies (Elf, Gnome, Tiefling) must
  // NOT also carry `subtrait_options` on a species-level trait — that double-models
  // the same choice (see stripRedundantLineageChoice in validate.ts).
  it('no species-with-subspecies trait keeps a redundant subtrait_options', () => {
    const speciesFile = path.join(ROOT, 'data', 'out', '5e-SRD-Species.json');
    if (!existsSync(speciesFile)) return;
    const species = JSON.parse(readFileSync(speciesFile, 'utf8')) as {
      index: string;
      subspecies: unknown[];
    }[];
    const withSubspecies = new Set(
      species.filter((s) => s.subspecies.length > 0).map((s) => s.index),
    );
    for (const trait of traits) {
      const t = trait as {
        index: string;
        species: { index: string }[];
        trait_specific?: { subtrait_options?: unknown };
      };
      if (!t.trait_specific?.subtrait_options) continue;
      const offending = t.species.find((s) => withSubspecies.has(s.index));
      expect(
        offending,
        `${t.index} has subtrait_options but its species '${offending?.index}' uses subspecies`,
      ).toBeUndefined();
    }
  });
});
