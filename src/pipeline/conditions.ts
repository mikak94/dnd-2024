import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { DATA, ROOT } from './config.ts';
import { ConditionSchema, type Condition } from './schemas/condition-2024.ts';

/**
 * Generate our authoritative 2024 condition dataset.
 *
 * Conditions are rules-glossary prose the wiki doesn't host as pages, so — like
 * proficiencies (see `proficiencies.ts`) — these are *derived* from the canonical
 * 5e-database 2024 condition list and written one-per-file into
 * `data/out/condition/`. Then `npm run validate condition` assembles
 * `data/out/5e-SRD-Conditions.json`.
 *
 * We keep 5e-database's indexes/names verbatim, normalize each `url` to the project
 * convention `/api/2024/conditions/<index>`, and split the single `description`
 * string into `desc` paragraphs to match this project's prose convention.
 */
interface ShippedCondition {
  index: string;
  name: string;
  description: string;
}

async function main() {
  const src = path.join(
    ROOT,
    'node_modules',
    '5e-database',
    'src',
    '2024',
    'en',
    '5e-SRD-Conditions.json',
  );
  const shipped = JSON.parse(readFileSync(src, 'utf8')) as ShippedCondition[];

  const outDir = path.join(DATA.out, 'condition');
  await fs.mkdir(outDir, { recursive: true });

  const records: Condition[] = shipped.map((c) => ({
    index: c.index,
    name: c.name,
    desc: c.description
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    url: `/api/2024/conditions/${c.index}`,
  }));

  let written = 0;
  for (const rec of records) {
    // Fail loud if a record doesn't match the schema rather than emit bad data.
    ConditionSchema.parse(rec);
    await fs.writeFile(
      path.join(outDir, `${rec.index}.json`),
      JSON.stringify(rec, null, 2) + '\n',
      'utf8',
    );
    written++;
  }

  console.log(
    `Generated ${written} condition records (from 5e-database) -> ${outDir}\n` +
      `Next: npm run validate condition`,
  );
}

await main();
