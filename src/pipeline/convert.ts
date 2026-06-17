import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { CATEGORIES, DATA, type Category } from './config.ts';

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
});

// Enable GFM tables, strikethrough, etc.
turndown.use(gfm);

/** Pull #page-content, drop scripts/styles and Wikidot ad units, return clean Markdown. */
function htmlToMarkdown(html: string): string {
  const $ = cheerio.load(html);
  const content = $('#page-content');
  if (content.length === 0) throw new Error('no #page-content div');
  content.find('script, style').remove();
  // Wikidot injects nitro ad placeholders like <div id="wad-..." class="wd-adunit ...">
  content.find('[class*="wd-adunit"], [id^="wad-"]').remove();
  const body = turndown.turndown(content.html() ?? '').trim();

  // The entity name lives in the page title, OUTSIDE #page-content. Prepend it
  // as an H1 so the extractor can read the canonical name (slugs lose casing and
  // punctuation, e.g. "tashas-hideous-laughter" -> "Tasha's Hideous Laughter").
  const title = (
    $('.page-title span').first().text() || $('title').text().split(' - ')[0]
  ).trim();
  return `# ${title}\n\n${body}`;
}

async function convert(cat: Category) {
  const srcDir = path.join(DATA.raw, cat.name);
  const outDir = path.join(DATA.md, cat.name);
  await fs.mkdir(outDir, { recursive: true });

  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith('.html'));
  let ok = 0;
  let failed = 0;
  for (const file of files) {
    const slug = file.replace(/\.html$/, '');
    try {
      const html = await fs.readFile(path.join(srcDir, file), 'utf8');
      const md = htmlToMarkdown(html);
      await fs.writeFile(path.join(outDir, `${slug}.md`), md, 'utf8');
      ok++;
    } catch (err) {
      failed++;
      console.warn(`  FAILED ${slug}: ${err}`);
    }
  }
  console.log(
    `Converted ${ok} files${failed ? `, ${failed} failed` : ''} -> ${outDir}`,
  );
}

const catKey = process.argv[2] ?? 'spells';
const cat = CATEGORIES[catKey];
if (!cat) {
  console.error(
    `Unknown category '${catKey}'. Known: ${Object.keys(CATEGORIES).join(', ')}`,
  );
  process.exit(1);
}
await convert(cat);
