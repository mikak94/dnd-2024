import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ProficiencySchema } from '../schemas/proficiency-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors spells.test.ts. Skipped until `npm run proficiencies` +
 * `npm run validate proficiency` produce data/out/5e-SRD-Proficiencies.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Proficiencies.json');
const bgFile = path.join(ROOT, 'data', 'out', '5e-SRD-Backgrounds.json');

function indexSet(p: string): Set<string> {
  const data = JSON.parse(readFileSync(p, 'utf8')) as { index: string }[];
  return new Set(data.map((d) => d.index));
}

describe.skipIf(!existsSync(file))('2024 proficiencies', () => {
  const profs = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as unknown[])
    : [];

  it('has records (did you run `npm run proficiencies`?)', () => {
    expect(profs.length).toBeGreaterThan(0);
  });

  it('every proficiency matches ProficiencySchema', () => {
    for (const p of profs) {
      const result = ProficiencySchema.safeParse(p);
      const id = (p as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = profs.map((p) => (p as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('includes the PHB category proficiencies backgrounds grant by choice', () => {
    const idx = new Set(profs.map((p) => (p as { index: string }).index));
    for (const cat of ['artisans-tools', 'gaming-set', 'musical-instrument']) {
      expect(idx.has(cat), `missing category proficiency '${cat}'`).toBe(true);
    }
  });

  it('url matches /api/2024/proficiencies/<index>', () => {
    for (const p of profs) {
      const x = p as { index: string; url: string };
      expect(x.url).toBe(`/api/2024/proficiencies/${x.index}`);
    }
  });

  // Cross-file: every proficiency a background grants must resolve to an emitted
  // proficiency record (this is what the 5e-database-naming normalization buys us).
  it.skipIf(!existsSync(bgFile))(
    'every background starting_proficiency resolves to a proficiency',
    () => {
      const profIdx = indexSet(file);
      const backgrounds = JSON.parse(readFileSync(bgFile, 'utf8')) as {
        index: string;
        starting_proficiencies: { index: string }[];
      }[];
      for (const bg of backgrounds) {
        for (const p of bg.starting_proficiencies) {
          expect(
            profIdx.has(p.index),
            `${bg.index} -> unknown proficiency ${p.index}`,
          ).toBe(true);
        }
      }
    },
  );
});
