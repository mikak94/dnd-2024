import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { SpellSchema } from '../schemas/spell-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors node_modules/5e-database/src/2024/tests/schemas.test.ts: every record
 * in the assembled file must pass the Zod schema. Run `npm run validate` first
 * to produce data/out/5e-SRD-Spells.json.
 */
describe('2024 spells', () => {
  const file = path.join(ROOT, 'data', 'out', '5e-SRD-Spells.json');
  const spells = JSON.parse(readFileSync(file, 'utf8')) as unknown[];

  it('has records (did you run the pipeline?)', () => {
    expect(spells.length).toBeGreaterThan(0);
  });

  it('every spell matches SpellSchema', () => {
    for (const spell of spells) {
      const result = SpellSchema.safeParse(spell);
      const id = (spell as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = spells.map((s) => (s as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });
});
