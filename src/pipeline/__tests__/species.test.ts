import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { SpeciesSchema } from '../schemas/species-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors spells.test.ts. Skipped until `npm run validate species` produces
 * data/out/5e-SRD-Species.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Species.json');
const traitFile = path.join(ROOT, 'data', 'out', '5e-SRD-Traits.json');
const subFile = path.join(ROOT, 'data', 'out', '5e-SRD-Subspecies.json');

function indexSet(p: string): Set<string> {
  const data = JSON.parse(readFileSync(p, 'utf8')) as { index: string }[];
  return new Set(data.map((d) => d.index));
}

describe.skipIf(!existsSync(file))('2024 species', () => {
  // Guarded so the describe body doesn't throw during collection when skipped.
  const species = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as unknown[])
    : [];

  it('has records (did you run the pipeline?)', () => {
    expect(species.length).toBeGreaterThan(0);
  });

  it('every species matches SpeciesSchema', () => {
    for (const sp of species) {
      const result = SpeciesSchema.safeParse(sp);
      const id = (sp as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = species.map((s) => (s as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('each species has exactly one of size / size_options', () => {
    for (const sp of species) {
      const s = sp as { index: string; size?: string; size_options?: unknown };
      const hasSize = s.size != null;
      const hasOptions = s.size_options != null;
      expect(hasSize !== hasOptions, `${s.index} size/size_options`).toBe(true);
    }
  });

  // Cross-file: the single-pass extractor guarantees these resolve. Only runs
  // once the trait/subspecies files have also been assembled.
  it.skipIf(!existsSync(traitFile) || !existsSync(subFile))(
    'traits[] / subspecies[] refs resolve to emitted records',
    () => {
      const traitIdx = indexSet(traitFile);
      const subIdx = indexSet(subFile);
      for (const sp of species) {
        const s = sp as {
          index: string;
          traits: { index: string }[];
          subspecies: { index: string }[];
        };
        for (const t of s.traits) {
          expect(
            traitIdx.has(t.index),
            `${s.index} -> missing trait ${t.index}`,
          ).toBe(true);
        }
        for (const sub of s.subspecies) {
          expect(
            subIdx.has(sub.index),
            `${s.index} -> missing subspecies ${sub.index}`,
          ).toBe(true);
        }
      }
    },
  );
});
