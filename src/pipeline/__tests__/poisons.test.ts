import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { PoisonSchema } from '../schemas/poison-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors equipment.test.ts. Skipped until the poison crawl/convert/extract +
 * `npm run validate poisons` produce data/out/5e-SRD-Poisons.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Poisons.json');
const TYPES = new Set(['ingested', 'inhaled', 'contact', 'injury']);

describe.skipIf(!existsSync(file))('2024 poisons', () => {
  const poisons = JSON.parse(readFileSync(file, 'utf8')) as unknown[];

  it('has records', () => {
    expect(poisons.length).toBeGreaterThan(0);
  });

  it('every poison matches PoisonSchema', () => {
    for (const p of poisons) {
      const result = PoisonSchema.safeParse(p);
      const id = (p as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = poisons.map((p) => (p as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('url matches /api/2024/poisons/<index>', () => {
    for (const p of poisons) {
      const x = p as { index: string; url: string };
      expect(x.url).toBe(`/api/2024/poisons/${x.index}`);
    }
  });

  it('type is a known delivery method', () => {
    for (const p of poisons) {
      const x = p as { index: string; type: string };
      expect(TYPES.has(x.type), `${x.index}: ${x.type}`).toBe(true);
    }
  });
});
