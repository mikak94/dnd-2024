import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repo root (two levels up from src/pipeline). */
export const ROOT = path.resolve(__dirname, '..', '..');

export const DATA = {
  raw: path.join(ROOT, 'data', 'raw'),
  md: path.join(ROOT, 'data', 'md'),
  out: path.join(ROOT, 'data', 'out'),
};

/** Wikidot site config. Note: site 301-redirects https -> http. */
export const SITE = 'http://dnd2024.wikidot.com';
export const USER_AGENT =
  'dnd2024-srd-builder/0.1 (personal study project; contact: mikayilg@madlan.co.il)';

/**
 * Per-category crawl config. `listing` is the index page; `prefix` is the
 * wiki namespace (`<prefix>:<slug>`). Stages 1-2 are category-agnostic; only
 * this table and the per-category schema (stage 3/4) change to add a category.
 */
export interface Category {
  /** Local folder name under data/raw, data/md, data/out. */
  name: string;
  /** Listing page path, e.g. "/spells". */
  listing: string;
  /** Wiki namespace prefix, e.g. "spell". */
  prefix: string;
  /** Slugs to drop (listing pages link to non-entity pages like school indexes). */
  exclude?: RegExp;
}

/** Rate limiting for polite crawling (ms between requests). */
export const CRAWL_DELAY_MS = 500;

/** All 12 PHB classes. */
export const CLASS_NAMES = [
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
] as const;

export type ClassName = (typeof CLASS_NAMES)[number];

/** Pages in class namespaces that are NOT subclasses (auxiliary pages). */
export const CLASS_AUXILIARY =
  /^(main|spell-list|fighting-style|maneuvers|pact-boon|eldritch-invocations?|metamagic)$/;

/** Subclass flavor text per class (e.g., "Primal Path" for barbarian). */
export const SUBCLASS_FLAVOR: Record<ClassName, string> = {
  barbarian: 'Primal Path',
  bard: 'Bard College',
  cleric: 'Divine Domain',
  druid: 'Druid Circle',
  fighter: 'Martial Archetype',
  monk: 'Monastic Tradition',
  paladin: 'Sacred Oath',
  ranger: 'Ranger Archetype',
  rogue: 'Roguish Archetype',
  sorcerer: 'Sorcerous Origin',
  warlock: 'Otherworldly Patron',
  wizard: 'Arcane Tradition',
};

export const CATEGORIES: Record<string, Category> = {
  spells: {
    name: 'spell',
    listing: '/spells',
    prefix: 'spell',
    // /spell:evocation-school etc. are school index pages, not spells.
    exclude: /-school$/,
  },
  classes: {
    name: 'class',
    listing: '', // No listing page; we iterate CLASS_NAMES directly.
    prefix: '', // Each class is <classname>:main.
  },
  subclasses: {
    name: 'subclass',
    listing: '', // Discovered from class pages.
    prefix: '', // Each subclass is <classname>:<subclass-slug>.
  },
  feats: {
    name: 'feat',
    listing: '/feats',
    prefix: 'feat',
  },
  backgrounds: {
    name: 'background',
    listing: '/backgrounds',
    prefix: 'background',
  },
  species: {
    name: 'species',
    listing: '/species',
    prefix: 'species',
  },
  // Base/mundane equipment lives as TABLE pages under the `equipment:` namespace
  // (weapons, armor, gear, tools, mounts), all linked from the /equipment:all hub.
  // The crawl fetches those category pages; the equipment extraction pass emits one
  // JSON record per table *row* into data/out/equipment/. We exclude the non-item
  // pages: currency (coin table), crafting (rules), trinket (flavor table), and
  // poison (its items overlap adventuring-gear).
  equipment: {
    name: 'equipment',
    listing: '/equipment:all',
    prefix: 'equipment',
    exclude: /^(all|currency|crafting|trinket|poison)$/,
  },
  // Magic items DO have one page per item under the `magic-item:` namespace, listed
  // on /magic-item:all (~390 items). These crawl/convert/extract like spells.
  'magic-items': {
    name: 'magic-item',
    listing: '/magic-item:all',
    prefix: 'magic-item',
    // `all` is the listing; `consumable` and `crafting` are an index page and a
    // rules page, not individual magic items.
    exclude: /^(all|consumable|crafting)$/,
  },
  // Poisons are a single TABLE page (`/equipment:poison`, one row per poison). There
  // are no per-poison pages, so `npm run crawl poisons` fetches that one page (handled
  // by the single-page branch in crawl.ts using `listing`); the poison extraction pass
  // emits one record per row into data/out/poison/. `prefix` is unused here.
  poisons: {
    name: 'poison',
    listing: '/equipment:poison',
    prefix: '',
  },
  // Eldritch Invocations and Metamagic options each live on a SINGLE wiki page the
  // class page links to but doesn't embed (`/warlock:eldritch-invocation`,
  // `/sorcerer:metamagic`). Like poisons, these are single-page crawls; the feature
  // extraction pass emits one parent-linked Feature record per option into
  // data/out/feature/ and wires the parent feature's feature_specific. `prefix` unused.
  invocations: {
    name: 'invocation',
    listing: '/warlock:eldritch-invocation',
    prefix: '',
  },
  metamagic: {
    name: 'metamagic',
    listing: '/sorcerer:metamagic',
    prefix: '',
  },
  // Multiclassing prerequisites + granted proficiencies live on ONE shared rules page
  // (`/class:multiclassing`), not on the individual class pages (those only link to it).
  // Crawl/convert it as a single page; it is a SOURCE the class-extraction pass reads to
  // fill each class's `multi_classing` field — it has no schema, no `data/out/` records,
  // and no validate registry entry of its own. `prefix` unused.
  multiclassing: {
    name: 'multiclassing',
    listing: '/class:multiclassing',
    prefix: '',
  },
  // NOTE: subspecies have NO entry here. They aren't separate wiki pages — each
  // species page embeds its subspecies inline (e.g. Elf's "Elven Lineages"). So,
  // like traits, subspecies are never crawled or converted; they're emitted by the
  // species extraction pass straight into data/out/subspecies/. (validate.ts still
  // registers `subspecies` so `npm run validate subspecies` assembles the records.)
  //
  // `proficiency` is likewise absent: it's an authoritative reference set generated
  // by `npm run proficiencies` (see proficiencies.ts), not crawled — validate.ts
  // registers it so `npm run validate proficiency` assembles the records.
};
