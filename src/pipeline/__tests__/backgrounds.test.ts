import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { BackgroundSchema } from '../schemas/background-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors spells.test.ts. Skipped until `npm run validate background` produces
 * data/out/5e-SRD-Backgrounds.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Backgrounds.json');

describe.skipIf(!existsSync(file))('2024 backgrounds', () => {
  // Guarded so the describe body doesn't throw during collection when skipped.
  const backgrounds = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as unknown[])
    : [];

  it('has records (did you run the pipeline?)', () => {
    expect(backgrounds.length).toBeGreaterThan(0);
  });

  it('every background matches BackgroundSchema', () => {
    for (const bg of backgrounds) {
      const result = BackgroundSchema.safeParse(bg);
      const id = (bg as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = backgrounds.map((b) => (b as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('each background grants a feat and ability-score options', () => {
    for (const bg of backgrounds) {
      const b = bg as {
        index: string;
        feat?: { index?: string };
        ability_scores?: unknown[];
      };
      expect(b.feat?.index, `${b.index} missing feat`).toBeTruthy();
      expect(
        (b.ability_scores ?? []).length,
        `${b.index} has no ability_scores`,
      ).toBeGreaterThan(0);
    }
  });
});
