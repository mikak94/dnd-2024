import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { DATA, ROOT } from './config.ts';
import {
  ProficiencySchema,
  type Proficiency,
} from './schemas/proficiency-2024.ts';

/**
 * Generate our authoritative 2024 proficiency dataset.
 *
 * Proficiencies aren't crawlable prose, so — like traits/subspecies are emitted
 * by the species pass — these are *derived* from the canonical 5e-database 2024
 * proficiency list (authoritative + independent of our own extraction, so
 * validating against it still catches typos) and written one-per-file into
 * `data/out/proficiency/`. Then `npm run validate proficiency` assembles
 * `data/out/5e-SRD-Proficiencies.json`.
 *
 * We keep 5e-database's indexes/names/types/reference verbatim (so refs that use
 * 5e-database naming resolve), normalize each `url` to the project convention
 * `/api/2024/proficiencies/<index>`, and add the 2024 proficiencies 5e-database
 * lacks but our content references (see EXTRA: the PHB category grants + the
 * Monk/Rogue weapon-property grants).
 */

interface ShippedProficiency {
  index: string;
  name: string;
  type: string;
  reference?: { index: string; name: string; url: string };
}

/**
 * 2024 proficiencies missing from the 5e-database list:
 *  - the three PHB category proficiencies backgrounds grant by choice
 *    ("Choose one kind of Artisan's Tools / Gaming Set / Musical Instrument");
 *  - the two weapon-property proficiency grants the PHB classes use
 *    (Monk: Martial weapons with the Light property; Rogue: with Finesse).
 */
const EXTRA: Proficiency[] = [
  {
    index: 'artisans-tools',
    name: "Artisan's Tools",
    type: "Artisan's Tools",
    url: '/api/2024/proficiencies/artisans-tools',
  },
  {
    index: 'gaming-set',
    name: 'Gaming Set',
    type: 'Tools',
    url: '/api/2024/proficiencies/gaming-set',
  },
  {
    index: 'musical-instrument',
    name: 'Musical Instrument',
    type: 'Musical Instruments',
    url: '/api/2024/proficiencies/musical-instrument',
  },
  {
    index: 'martial-weapons-light',
    name: 'Martial Weapons (Light)',
    type: 'Weapons',
    url: '/api/2024/proficiencies/martial-weapons-light',
  },
  {
    index: 'martial-weapons-finesse',
    name: 'Martial Weapons (Finesse)',
    type: 'Weapons',
    url: '/api/2024/proficiencies/martial-weapons-finesse',
  },
];

/**
 * Normalize a proficiency's equipment `reference` to our equipment slugs. 5e-database
 * is internally inconsistent: its equipment index for Cartographer's Tools is the
 * singular `cartographer-tools`, while every other artisan tool (and our wiki-derived
 * equipment set) uses the plural-possessive form (`cartographers-tools`, `smiths-tools`).
 * Repoint the reference so it resolves against our equipment dataset.
 */
function normalizeRef(ref: { index: string; name: string; url: string }) {
  // Only the known equipment-slug drift; leave skill/ability references untouched.
  const fixes: Record<string, string> = {
    'cartographer-tools': 'cartographers-tools',
  };
  const fixed = fixes[ref.index];
  if (!fixed) return ref;
  return { index: fixed, name: ref.name, url: `/api/2024/equipment/${fixed}` };
}

async function main() {
  const src = path.join(
    ROOT,
    'node_modules',
    '5e-database',
    'src',
    '2024',
    'en',
    '5e-SRD-Proficiencies.json',
  );
  const shipped = JSON.parse(readFileSync(src, 'utf8')) as ShippedProficiency[];

  const outDir = path.join(DATA.out, 'proficiency');
  await fs.mkdir(outDir, { recursive: true });

  const records: Proficiency[] = [
    ...shipped.map((p) => ({
      index: p.index,
      name: p.name,
      type: p.type,
      ...(p.reference ? { reference: normalizeRef(p.reference) } : {}),
      url: `/api/2024/proficiencies/${p.index}`,
    })),
    ...EXTRA,
  ];

  let written = 0;
  for (const rec of records) {
    // Fail loud if a record doesn't match the schema rather than emit bad data.
    ProficiencySchema.parse(rec);
    await fs.writeFile(
      path.join(outDir, `${rec.index}.json`),
      JSON.stringify(rec, null, 2) + '\n',
      'utf8',
    );
    written++;
  }

  console.log(
    `Generated ${written} proficiency records (${shipped.length} from 5e-database + ${EXTRA.length} added) -> ${outDir}\n` +
      `Next: npm run validate proficiency`,
  );
}

await main();
