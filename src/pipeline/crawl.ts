import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Bottleneck from 'bottleneck';
import {
  CATEGORIES,
  CLASS_AUXILIARY,
  CLASS_NAMES,
  CRAWL_DELAY_MS,
  DATA,
  SITE,
  USER_AGENT,
  type Category,
} from './config.ts';

// Parallelism + politeness, managed globally by bottleneck:
//   maxConcurrent — at most this many requests in flight at once.
//   minTime       — minimum ms between request *starts*, so the throughput
//                   ceiling is ~ (1000 / minTime) req/s regardless of concurrency.
const MAX_CONCURRENT = 5;
const MIN_TIME_MS = 250; // -> ~4 req/s ceiling
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 1000;

const limiter = new Bottleneck({
  maxConcurrent: MAX_CONCURRENT,
  minTime: MIN_TIME_MS,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url: string): Promise<string> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} (non-retryable)`);
      return await res.text();
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const backoff = BACKOFF_BASE_MS * 2 ** attempt;
      console.warn(
        `  retry ${attempt}/${MAX_RETRIES} for ${url} after ${backoff}ms (${err})`,
      );
      await sleep(backoff);
    }
  }
  throw new Error('unreachable');
}

/** Extract `<prefix>:<slug>` page slugs from a listing page's HTML. */
function extractSlugs(html: string, cat: Category): string[] {
  const re = new RegExp(`href="/${cat.prefix}:([a-z0-9-]+)"`, 'g');
  const slugs = new Set<string>();
  for (const m of html.matchAll(re)) {
    const slug = m[1];
    if (cat.exclude?.test(slug)) continue;
    slugs.add(slug);
  }
  return [...slugs].sort();
}

/** Extract subclass slugs from a class page, filtering out auxiliary pages. */
function extractSubclassSlugs(html: string, className: string): string[] {
  const re = new RegExp(`href="/${className}:([a-z0-9-]+)"`, 'g');
  const slugs = new Set<string>();
  for (const m of html.matchAll(re)) {
    const slug = m[1];
    if (CLASS_AUXILIARY.test(slug)) continue;
    slugs.add(slug);
  }
  return [...slugs].sort();
}

/** Crawl all 12 PHB class main pages. */
async function crawlClasses() {
  const outDir = path.join(DATA.raw, 'class');
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Crawling ${CLASS_NAMES.length} class main pages...`);
  let fetched = 0;
  let skipped = 0;

  for (const className of CLASS_NAMES) {
    const outFile = path.join(outDir, `${className}.html`);
    try {
      await fs.access(outFile);
      skipped++;
      continue;
    } catch {
      // File doesn't exist, proceed to fetch.
    }

    await sleep(CRAWL_DELAY_MS);
    try {
      const html = await fetchText(`${SITE}/${className}:main`);
      await fs.writeFile(outFile, html, 'utf8');
      fetched++;
      console.log(`  Fetched ${className}:main`);
    } catch (err) {
      console.warn(`  FAILED ${className}:main: ${err}`);
    }
  }

  console.log(
    `Done: ${fetched} fetched, ${skipped} already on disk -> ${outDir}`,
  );
}

/** Discover and crawl subclass pages from all 12 class namespaces. */
async function crawlSubclasses() {
  const outDir = path.join(DATA.raw, 'subclass');
  const classDir = path.join(DATA.raw, 'class');
  await fs.mkdir(outDir, { recursive: true });

  console.log('Discovering subclasses from class pages...');
  const allSubclasses: Array<{ className: string; slug: string }> = [];

  for (const className of CLASS_NAMES) {
    const classFile = path.join(classDir, `${className}.html`);
    let html: string;
    try {
      html = await fs.readFile(classFile, 'utf8');
    } catch {
      console.warn(`  Class page not found for ${className}, fetching...`);
      await sleep(CRAWL_DELAY_MS);
      html = await fetchText(`${SITE}/${className}:main`);
      await fs.mkdir(classDir, { recursive: true });
      await fs.writeFile(
        path.join(classDir, `${className}.html`),
        html,
        'utf8',
      );
    }

    const slugs = extractSubclassSlugs(html, className);
    for (const slug of slugs) {
      allSubclasses.push({ className, slug });
    }
    console.log(`  ${className}: found ${slugs.length} subclasses`);
  }

  console.log(`Total: ${allSubclasses.length} subclasses discovered.`);

  let fetched = 0;
  let skipped = 0;

  for (const { className, slug } of allSubclasses) {
    const outFile = path.join(outDir, `${className}--${slug}.html`);
    try {
      await fs.access(outFile);
      skipped++;
      continue;
    } catch {
      // File doesn't exist, proceed to fetch.
    }

    await sleep(CRAWL_DELAY_MS);
    try {
      const html = await fetchText(`${SITE}/${className}:${slug}`);
      await fs.writeFile(outFile, html, 'utf8');
      fetched++;
      if (fetched % 10 === 0) console.log(`  ...${fetched} subclasses fetched`);
    } catch (err) {
      console.warn(`  FAILED ${className}:${slug}: ${err}`);
    }
  }

  console.log(
    `Done: ${fetched} fetched, ${skipped} already on disk -> ${outDir}`,
  );
}

async function crawl(cat: Category, limit?: number) {
  const outDir = path.join(DATA.raw, cat.name);
  await fs.mkdir(outDir, { recursive: true });

  console.log(`Fetching listing ${SITE}${cat.listing} ...`);
  const listingHtml = await fetchText(`${SITE}${cat.listing}`);
  let slugs = extractSlugs(listingHtml, cat);
  if (limit) slugs = slugs.slice(0, limit);
  console.log(
    `Found ${slugs.length} ${cat.name} pages${limit ? ` (limited to ${limit})` : ''}.`,
  );

  // Resumable: only fetch slugs we don't already have on disk.
  const exists = await Promise.all(
    slugs.map((slug) =>
      fs
        .access(path.join(outDir, `${slug}.html`))
        .then(() => true)
        .catch(() => false),
    ),
  );
  const todo = slugs.filter((_, i) => !exists[i]);
  const skipped = slugs.length - todo.length;

  let fetched = 0;
  let failed = 0;
  // Schedule every fetch through the limiter; it caps concurrency and spacing
  // globally. Per-job try/catch keeps one failure from aborting the batch.
  await Promise.all(
    todo.map((slug) =>
      limiter.schedule(async () => {
        try {
          const html = await fetchText(`${SITE}/${cat.prefix}:${slug}`);
          await fs.writeFile(path.join(outDir, `${slug}.html`), html, 'utf8');
          fetched++;
          if (fetched % 25 === 0)
            console.log(`  ...${fetched}/${todo.length} fetched`);
        } catch (err) {
          failed++;
          console.warn(`  FAILED ${slug}: ${err}`);
        }
      }),
    ),
  );
  console.log(
    `Done: ${fetched} fetched${failed ? `, ${failed} failed` : ''}, ` +
      `${skipped} already on disk -> ${outDir}`,
  );
}

/**
 * Crawl a single page (no sub-links) into `data/raw/<cat.name>/<cat.name>.html`.
 * Used for table-only categories like poisons, whose data lives entirely on one
 * page (`/equipment:poison`) with no per-item pages to discover.
 */
async function crawlSinglePage(cat: Category) {
  const outDir = path.join(DATA.raw, cat.name);
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, `${cat.name}.html`);
  try {
    await fs.access(outFile);
    console.log(`Already on disk -> ${outFile}`);
    return;
  } catch {
    // Not on disk yet; fetch it.
  }
  console.log(`Fetching ${SITE}${cat.listing} ...`);
  const html = await fetchText(`${SITE}${cat.listing}`);
  await fs.writeFile(outFile, html, 'utf8');
  console.log(`Done: 1 fetched -> ${outFile}`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : undefined;
  const catKey =
    args.find((a) => !a.startsWith('--') && a !== String(limit)) ?? 'spells';
  return { catKey, limit };
}

const { catKey, limit } = parseArgs();
const cat = CATEGORIES[catKey];
if (!cat) {
  console.error(
    `Unknown category '${catKey}'. Known: ${Object.keys(CATEGORIES).join(', ')}`,
  );
  process.exit(1);
}

if (catKey === 'classes') {
  await crawlClasses();
} else if (catKey === 'subclasses') {
  await crawlSubclasses();
} else if (
  catKey === 'poisons' ||
  catKey === 'invocations' ||
  catKey === 'metamagic' ||
  catKey === 'multiclassing'
) {
  await crawlSinglePage(cat);
} else {
  await crawl(cat, limit);
}
