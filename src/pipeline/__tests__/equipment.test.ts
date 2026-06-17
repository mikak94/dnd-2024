import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { EquipmentSchema } from '../schemas/equipment-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors spells.test.ts. Skipped until the equipment crawl/convert/extract +
 * `npm run validate equipment` produce data/out/5e-SRD-Equipment.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Equipment.json');

function indexSet(p: string): Set<string> {
  const data = JSON.parse(readFileSync(p, 'utf8')) as { index: string }[];
  return new Set(data.map((d) => d.index));
}

// Every `/api/2024/equipment/<index>` reference reachable in an assembled file.
function equipmentRefsIn(p: string): { from: string; index: string }[] {
  const out: { from: string; index: string }[] = [];
  const records = JSON.parse(readFileSync(p, 'utf8')) as { index: string }[];
  const walk = (from: string, n: unknown) => {
    if (Array.isArray(n)) n.forEach((x) => walk(from, x));
    else if (n && typeof n === 'object') {
      const o = n as Record<string, unknown>;
      const m =
        typeof o.url === 'string' &&
        /\/api\/2024\/equipment\/([^/]+)$/.exec(o.url);
      if (m) out.push({ from, index: m[1] });
      Object.values(o).forEach((v) => walk(from, v));
    }
  };
  for (const rec of records) walk(rec.index, rec);
  return out;
}

describe.skipIf(!existsSync(file))('2024 equipment', () => {
  const items = JSON.parse(readFileSync(file, 'utf8')) as unknown[];

  it('has records', () => {
    expect(items.length).toBeGreaterThan(0);
  });

  it('every item matches EquipmentSchema', () => {
    for (const item of items) {
      const result = EquipmentSchema.safeParse(item);
      const id = (item as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = items.map((i) => (i as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('url matches /api/2024/equipment/<index>', () => {
    for (const i of items) {
      const x = i as { index: string; url: string };
      expect(x.url).toBe(`/api/2024/equipment/${x.index}`);
    }
  });

  it('includes representative weapons/armor/tools and the category-grant extras', () => {
    const idx = new Set(items.map((i) => (i as { index: string }).index));
    for (const want of [
      'longsword',
      'leather-armor',
      'shield',
      'smiths-tools',
      'artisans-tools',
      'gaming-set',
      'musical-instrument',
    ]) {
      expect(idx.has(want), `missing equipment '${want}'`).toBe(true);
    }
  });

  // Cross-file: every equipment a background/class/proficiency references must
  // resolve to an emitted equipment record — this is the closed integrity gap.
  it('every equipment reference across the dataset resolves', () => {
    const eqIdx = indexSet(file);
    const out = path.join(ROOT, 'data', 'out');
    for (const name of [
      'Backgrounds',
      'Classes',
      'Proficiencies',
      'Equipment',
    ]) {
      const p = path.join(out, `5e-SRD-${name}.json`);
      if (!existsSync(p)) continue;
      for (const ref of equipmentRefsIn(p)) {
        expect(
          eqIdx.has(ref.index),
          `${name}:${ref.from} -> unknown equipment ${ref.index}`,
        ).toBe(true);
      }
    }
  });
});
