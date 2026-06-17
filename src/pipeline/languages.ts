import * as fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { DATA, ROOT } from './config.ts';
import { LanguageSchema, type Language } from './schemas/language-2024.ts';

/**
 * Generate our authoritative 2024 language dataset.
 *
 * Languages aren't hosted as wiki pages, so — like proficiencies (see
 * `proficiencies.ts`) — these are *derived* from the canonical 5e-database 2024
 * language list and written one-per-file into `data/out/language/`. Then
 * `npm run validate language` assembles `data/out/5e-SRD-Languages.json`.
 *
 * We keep 5e-database's indexes/names/is_rare/note verbatim and normalize each
 * `url` to the project convention `/api/2024/languages/<index>`.
 */
interface ShippedLanguage {
  index: string;
  name: string;
  is_rare: boolean;
  note?: string;
}

async function main() {
  const src = path.join(
    ROOT,
    'node_modules',
    '5e-database',
    'src',
    '2024',
    'en',
    '5e-SRD-Languages.json',
  );
  const shipped = JSON.parse(readFileSync(src, 'utf8')) as ShippedLanguage[];

  const outDir = path.join(DATA.out, 'language');
  await fs.mkdir(outDir, { recursive: true });

  const records: Language[] = shipped.map((l) => ({
    index: l.index,
    name: l.name,
    is_rare: l.is_rare,
    note: l.note ?? '',
    url: `/api/2024/languages/${l.index}`,
  }));

  let written = 0;
  for (const rec of records) {
    // Fail loud if a record doesn't match the schema rather than emit bad data.
    LanguageSchema.parse(rec);
    await fs.writeFile(
      path.join(outDir, `${rec.index}.json`),
      JSON.stringify(rec, null, 2) + '\n',
      'utf8',
    );
    written++;
  }

  console.log(
    `Generated ${written} language records (from 5e-database) -> ${outDir}\n` +
      `Next: npm run validate language`,
  );
}

await main();
