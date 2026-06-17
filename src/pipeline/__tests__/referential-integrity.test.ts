import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ROOT } from '../config.ts';

/**
 * Whole-dataset referential integrity: every `{ index, url }` reference in every
 * assembled `5e-SRD-*.json` must resolve to an entity that actually exists —
 * walking nested Choices (option items, trait_specific, subtrait_options, …),
 * not just top-level fields. This guards against slug drift between a reference
 * and its target (e.g. a renamed subspecies, an apostrophe-slug spell, a feat
 * prerequisite pointing at a feat that was never extracted).
 *
 * There are no documented exceptions: every reference in the assembled output must
 * resolve. (The former equipment gap was closed by the equipment + magic-items
 * datasets; the Artificer gap by stripping that non-PHB class during assembly.)
 */

const OUT = path.join(ROOT, 'data', 'out');
const SRD = path.join(ROOT, 'node_modules', '5e-database', 'src', '2024', 'en');

function indexesOf(p: string): Set<string> {
  const data = JSON.parse(readFileSync(p, 'utf8')) as { index: string }[];
  return new Set(data.map((d) => d.index));
}

// Map a URL path segment -> the set of indexes valid for that segment.
// Our own assembled categories resolve against our output; the small stable
// reference categories (abilities/damage-types/schools/skills) against the SRD.
const OUR: Record<string, string> = {
  spells: 'Spells',
  classes: 'Classes',
  subclasses: 'Subclasses',
  features: 'Features',
  levels: 'Levels',
  feats: 'Feats',
  backgrounds: 'Backgrounds',
  species: 'Species',
  subspecies: 'Subspecies',
  traits: 'Traits',
  proficiencies: 'Proficiencies',
  equipment: 'Equipment',
  'magic-items': 'Magic-Items',
  conditions: 'Conditions',
  languages: 'Languages',
  poisons: 'Poisons',
};
const SRD_REF: Record<string, string> = {
  'ability-scores': 'Ability-Scores',
  'damage-types': 'Damage-Types',
  'magic-schools': 'Magic-Schools',
  skills: 'Skills',
  // Closed equipment taxonomies: we crawl the items but their category/property/
  // mastery refs resolve against these canonical 5e-database lists.
  'equipment-categories': 'Equipment-Categories',
  'weapon-properties': 'Weapon-Properties',
  'weapon-mastery-properties': 'Weapon-Mastery-Properties',
};

// Mounts/vehicles categories we coin (5e-database ships none); kept in sync with
// EXTRA_EQUIPMENT_CATEGORIES in validate.ts.
const EXTRA_EQUIPMENT_CATEGORIES = [
  'mounts-and-vehicles',
  'mounts-and-other-animals',
  'tack-harness-and-drawn-vehicles',
  'waterborne-vehicles',
];

const coreFile = path.join(OUT, '5e-SRD-Species.json');

describe.skipIf(!existsSync(coreFile))('referential integrity', () => {
  const SETS: Record<string, Set<string>> = {};
  for (const [seg, name] of Object.entries(OUR)) {
    const p = path.join(OUT, `5e-SRD-${name}.json`);
    if (existsSync(p)) SETS[seg] = indexesOf(p);
  }
  for (const [seg, name] of Object.entries(SRD_REF)) {
    SETS[seg] = indexesOf(path.join(SRD, `5e-SRD-${name}.json`));
  }
  for (const c of EXTRA_EQUIPMENT_CATEGORIES)
    SETS['equipment-categories'].add(c);

  // url -> { seg, index } for resolvable entity refs; index null for API
  // sub-resource URLs that aren't entity references (e.g. /classes/x/levels).
  function classify(url: string): { seg: string; index: string | null } | null {
    const marker = '/api/2024/';
    const at = url.indexOf(marker);
    if (at < 0) return null;
    const parts = url
      .slice(at + marker.length)
      .split('/')
      .filter(Boolean);
    // /classes/<class>/levels/<n> is a Level reference (index "<class>-<n>").
    if (parts.length >= 4 && parts[0] === 'classes' && parts[2] === 'levels') {
      return { seg: 'levels', index: `${parts[1]}-${parts[3]}` };
    }
    if (parts.length === 2) return { seg: parts[0], index: parts[1] };
    return { seg: parts[0], index: null };
  }

  // Every nested object carrying both string `index` and string `url`.
  function collectRefs(node: unknown): { index: string; url: string }[] {
    const out: { index: string; url: string }[] = [];
    const walk = (n: unknown) => {
      if (Array.isArray(n)) {
        n.forEach(walk);
      } else if (n && typeof n === 'object') {
        const o = n as Record<string, unknown>;
        if (typeof o.index === 'string' && typeof o.url === 'string') {
          out.push({ index: o.index, url: o.url });
        }
        Object.values(o).forEach(walk);
      }
    };
    walk(node);
    return out;
  }

  // Walk every assembled record and bucket each reference. There are no documented
  // gaps left: the equipment gap was closed by the equipment + magic-items datasets,
  // and the Artificer gap by stripping the non-PHB class during assembly (validate.ts
  // `stripArtificer`). Every reference in the assembled output must now resolve.
  const unexpected: string[] = [];
  let checked = 0;

  for (const name of Object.values(OUR)) {
    const p = path.join(OUT, `5e-SRD-${name}.json`);
    if (!existsSync(p)) continue;
    const records = JSON.parse(readFileSync(p, 'utf8')) as {
      index: string;
      url?: string;
    }[];
    for (const rec of records) {
      for (const ref of collectRefs(rec)) {
        if (ref.url === rec.url) continue; // the record's own self-ref
        const c = classify(ref.url);
        if (!c || c.index === null) continue; // not an entity reference
        checked++;
        const set = SETS[c.seg];
        if (set && set.has(c.index)) continue; // resolves ✓
        unexpected.push(
          `${name}:${rec.index} -> ${c.seg}/${c.index} (${ref.url})`,
        );
      }
    }
  }

  it('walks a meaningful number of references', () => {
    expect(checked).toBeGreaterThan(1000);
  });

  it('every reference resolves', () => {
    expect(
      unexpected.length,
      `Unresolved references:\n${unexpected.join('\n')}`,
    ).toBe(0);
  });
});
