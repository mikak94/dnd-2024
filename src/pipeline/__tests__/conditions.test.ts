import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ConditionSchema } from '../schemas/condition-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors proficiencies.test.ts. Skipped until `npm run conditions` +
 * `npm run validate condition` produce data/out/5e-SRD-Conditions.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Conditions.json');

describe.skipIf(!existsSync(file))('2024 conditions', () => {
  const conditions = JSON.parse(readFileSync(file, 'utf8')) as unknown[];

  it('has records (did you run `npm run conditions`?)', () => {
    expect(conditions.length).toBeGreaterThan(0);
  });

  it('every condition matches ConditionSchema', () => {
    for (const c of conditions) {
      const result = ConditionSchema.safeParse(c);
      const id = (c as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = conditions.map((c) => (c as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('url matches /api/2024/conditions/<index>', () => {
    for (const c of conditions) {
      const x = c as { index: string; url: string };
      expect(x.url).toBe(`/api/2024/conditions/${x.index}`);
    }
  });

  it('includes the core PHB conditions', () => {
    const idx = new Set(conditions.map((c) => (c as { index: string }).index));
    for (const want of ['blinded', 'grappled', 'prone', 'unconscious']) {
      expect(idx.has(want), `missing condition '${want}'`).toBe(true);
    }
  });
});
