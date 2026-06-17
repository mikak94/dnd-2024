import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { LanguageSchema } from '../schemas/language-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors proficiencies.test.ts. Skipped until `npm run languages` +
 * `npm run validate language` produce data/out/5e-SRD-Languages.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Languages.json');

describe.skipIf(!existsSync(file))('2024 languages', () => {
  const languages = JSON.parse(readFileSync(file, 'utf8')) as unknown[];

  it('has records (did you run `npm run languages`?)', () => {
    expect(languages.length).toBeGreaterThan(0);
  });

  it('every language matches LanguageSchema', () => {
    for (const l of languages) {
      const result = LanguageSchema.safeParse(l);
      const id = (l as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = languages.map((l) => (l as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('url matches /api/2024/languages/<index>', () => {
    for (const l of languages) {
      const x = l as { index: string; url: string };
      expect(x.url).toBe(`/api/2024/languages/${x.index}`);
    }
  });

  it('has both standard and rare languages', () => {
    const rare = languages.filter((l) => (l as { is_rare: boolean }).is_rare);
    expect(rare.length).toBeGreaterThan(0);
    expect(rare.length).toBeLessThan(languages.length);
  });
});
