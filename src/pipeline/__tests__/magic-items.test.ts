import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { MagicItemSchema } from '../schemas/magic-item-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors spells.test.ts. Skipped until the magic-items crawl/convert/extract +
 * `npm run validate magic-items` produce data/out/5e-SRD-Magic-Items.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Magic-Items.json');

const RARITIES = new Set([
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary',
  'Artifact',
  'Varies',
]);

describe.skipIf(!existsSync(file))('2024 magic items', () => {
  const items = JSON.parse(readFileSync(file, 'utf8')) as unknown[];

  it('has records', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it('every item matches MagicItemSchema', () => {
    for (const item of items) {
      const result = MagicItemSchema.safeParse(item);
      const id = (item as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = items.map((i) => (i as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('url matches /api/2024/magic-items/<index>', () => {
    for (const i of items) {
      const x = i as { index: string; url: string };
      expect(x.url).toBe(`/api/2024/magic-items/${x.index}`);
    }
  });

  it('rarity is a known value', () => {
    for (const i of items) {
      const x = i as { index: string; rarity: { name: string } };
      expect(RARITIES.has(x.rarity.name), `${x.index}: ${x.rarity.name}`).toBe(
        true,
      );
    }
  });
});
