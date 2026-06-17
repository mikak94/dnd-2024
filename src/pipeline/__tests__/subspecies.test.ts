import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { SubspeciesSchema } from '../schemas/subspecies-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors spells.test.ts. Skipped until `npm run validate subspecies` produces
 * data/out/5e-SRD-Subspecies.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Subspecies.json');

describe.skipIf(!existsSync(file))('2024 subspecies', () => {
  // Guarded so the describe body doesn't throw during collection when skipped.
  const subspecies = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as unknown[])
    : [];

  it('has records (did you run the pipeline?)', () => {
    expect(subspecies.length).toBeGreaterThan(0);
  });

  it('every subspecies matches SubspeciesSchema', () => {
    for (const sub of subspecies) {
      const result = SubspeciesSchema.safeParse(sub);
      const id = (sub as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = subspecies.map((s) => (s as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('each subspecies references a parent species', () => {
    for (const sub of subspecies) {
      const s = sub as { index: string; species?: { url?: string } };
      expect(
        s.species?.url?.startsWith('/api/2024/species/'),
        `${s.index} missing/invalid species ref`,
      ).toBe(true);
    }
  });
});
