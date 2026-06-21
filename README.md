# D&D 2024 → 5e-database pipeline

Builds [5e-database](https://github.com/5e-bits/5e-database)-compatible 2024-edition
JSON from [dnd2024.wikidot.com](http://dnd2024.wikidot.com). The shipped 2024 dataset
is sparse, so we rebuild from the wiki. The pipeline now covers the full PHB:
**spells, classes, subclasses, features (class + subclass), levels, feats, backgrounds,
species, subspecies, traits, equipment, magic items, and poisons**, plus authoritative
**proficiencies, conditions, and languages** reference sets.
A whole-dataset [referential-integrity test](#referential-integrity) keeps every
cross-reference between entities resolving.

## Current Status

| Category           | Crawl | Convert | Extract | Validate |
| ------------------ | ----- | ------- | ------- | -------- |
| Spells (424)       | ✅    | ✅      | ✅      | ✅       |
| Classes (12)       | ✅    | ✅      | ✅      | ✅       |
| Subclasses (62)    | ✅    | ✅      | ✅      | ✅       |
| Features (541)     | ✅ \* | ✅ \*   | ✅      | ✅       |
| Levels (240)       | ✅ \* | ✅ \*   | ✅      | ✅       |
| Feats (171)        | ✅    | ✅      | ✅      | ✅       |
| Backgrounds (61)   | ✅    | ✅      | ✅      | ✅       |
| Species (24)       | ✅    | ✅      | ✅      | ✅       |
| Subspecies (10)    | — †   | — †     | ✅      | ✅       |
| Traits (108)       | — ‡   | — ‡     | ✅      | ✅       |
| Proficiencies (79) | — §   | — §     | — §     | ✅       |
| Equipment (221)    | ✅ ¶  | ✅ ¶    | ✅ ¶    | ✅       |
| Magic Items (388)  | ✅    | ✅      | ✅      | ✅       |
| Poisons (14)       | ✅ ◊  | ✅ ◊    | ✅ ◊    | ✅       |
| Conditions (15)    | — §   | — §     | — §     | ✅       |
| Languages (19)     | — §   | — §     | — §     | ✅       |

> **\*** Features and Levels don't need separate crawling — they're extracted from existing files:
>
> - **Features** are parsed from `data/md/subclass/*.md` (subclass features) **and** `data/md/class/*.md` (base-class features, driven from each class's Level manifest so the indexes match the Level→feature refs). The 58 **option** features — Eldritch Invocations (28), Metamagic (10), Battle Master Maneuvers (20) — are parent-linked records: invocations/metamagic come from two single-page crawls (`invocations`, `metamagic`); maneuvers from the Battle Master subclass page. See the "Parent-linked option records" section of `feature-extraction.md`.
> - **Levels** are parsed from `data/md/class/*.md` (each class file contains a level progression table)
>
> **†** Subspecies have no separate wiki pages — each species page embeds them inline (e.g. Elf's "Elven Lineages"). So, like traits, they aren't crawled or converted; they're emitted alongside their parent during the species extraction pass.
> **‡** Traits aren't crawled or converted — they're emitted alongside their parent during the species extraction pass.
> **§** Some reference sets aren't crawlable prose, so they're **generated from the canonical 5e-database 2024 lists** (like traits/subspecies are emitted by the species pass), then assembled by `npm run validate <cat>`:
>
> - **Proficiencies** — `npm run proficiencies`: the 5e-database list + the 2024 proficiencies it lacks (the PHB category grants `artisans-tools`/`gaming-set`/`musical-instrument` and the Monk/Rogue weapon-property grants `martial-weapons-light`/`martial-weapons-finesse`). Backgrounds/feats/traits/classes validate their proficiency refs against it.
> - **Conditions** — `npm run conditions`: the 15 PHB conditions. The wiki hosts no rules-glossary pages, so these can't be crawled.
> - **Languages** — `npm run languages`: the 19 PHB languages (same reason).
>
> **¶** **Equipment is table-shaped, not one-page-per-item.** Base/mundane equipment lives in tables on a handful of wiki pages under the `equipment:` namespace (`equipment:weapon` / `:armor` / `:adventuring-gear` / `:tool` / `:mounts-and-vehicles`, linked from `/equipment:all`). The crawl fetches those ~5 category pages; the extraction pass emits **one record per table row** (plus three category-grant extras `artisans-tools`/`gaming-set`/`musical-instrument` and a few grouped focus items). **Magic Items**, by contrast, are one page per item under the `magic-item:` namespace (listed on `/magic-item:all`) and extract like spells.
>
> **◊** **Poisons** are a single table page (`/equipment:poison`). `npm run crawl poisons` fetches just that page (the single-page branch in `crawl.ts`); the extraction pass emits **one record per row** into `data/out/poison/`.

## Pipeline Stages

Four resumable stages, each writing to disk:

| Stage       | Script                        | Input → Output                                           |
| ----------- | ----------------------------- | -------------------------------------------------------- |
| 1. Crawl    | `npm run crawl <category>`    | listing/discovery → `data/raw/<cat>/<slug>.html`         |
| 2. Convert  | `npm run convert <category>`  | raw HTML → `data/md/<cat>/<slug>.md`                     |
| 3. Extract  | _(subagents — see below)_     | Markdown → `data/out/<cat>/<slug>.json`                  |
| 4. Validate | `npm run validate <category>` | per-entity JSON → validated `data/out/5e-SRD-<Cat>.json` |

## Run it

```sh
npm install

# Spells (already complete)
npm run crawl spells && npm run convert spells
# extract via subagents...
npm run validate spell

# Classes, Subclasses, Features (class + subclass), Levels
npm run crawl classes && npm run convert classes
npm run crawl subclasses && npm run convert subclasses
# Eldritch Invocations & Metamagic live on their own wiki pages (not the class page), so
# crawl them as single pages; Battle Master Maneuvers come from the subclass page already.
npm run crawl invocations && npm run convert invocations
npm run crawl metamagic && npm run convert metamagic
# extract via subagents (subclass features from subclass pages;
# base-class features from class pages via class-feature-extraction.md).
# Feature extraction also fills feature_specific option choices (Fighting Style / Expertise /
# Weapon Mastery) from each feature's prose, and emits the 58 parent-linked Invocation /
# Metamagic / Maneuver option records — see the "Option choices" and "Parent-linked option
# records" sections in feature-extraction.md.
npm run validate class
npm run validate subclass
npm run validate feature
npm run validate level

# Reference sets generated from 5e-database (not crawlable prose on the wiki).
# Build proficiencies first — backgrounds/feats/traits validate their refs against it.
npm run proficiencies && npm run validate proficiency
npm run conditions && npm run validate condition
npm run languages && npm run validate language

# Character creation: feats, backgrounds, species (+subspecies, +traits)
npm run crawl feats && npm run crawl backgrounds && npm run crawl species
npm run convert feats && npm run convert backgrounds && npm run convert species
# (no crawl/convert for subspecies or traits — both are embedded in species pages
#  and emitted by the species extraction pass)
# extract via subagents, in order: feats -> backgrounds -> species (emits species + subspecies + traits)
npm run validate feat && npm run validate background
npm run validate species && npm run validate subspecies && npm run validate trait

# Equipment (table pages → one record per row) and Magic Items (one page per item)
npm run crawl equipment && npm run convert equipment
npm run crawl magic-items && npm run convert magic-items
# extract via subagents: equipment-extraction.md (tables) and magic-item-extraction.md (prose)
npm run validate equipment && npm run validate magic-items

# Poisons (single table page /equipment:poison → one record per row)
npm run crawl poisons && npm run convert poisons
# extract via subagent: poison-extraction.md
npm run validate poisons
```

> Requires Node ≥ 22 (vitest's runner needs `node:util` `styleText`). Use `nvm use 22`.

All stages skip work already on disk, so a failed run resumes where it left off.

## Stage 3 — Extraction (subagents)

Extraction specs live in `src/pipeline/prompts/`:

| Spec                          | Model  | Extracts                                                        |
| ----------------------------- | ------ | --------------------------------------------------------------- |
| `spell-extraction.md`         | Sonnet | 1 spell per file                                                |
| `class-extraction.md`         | Sonnet | 1 class per file                                                |
| `subclass-extraction.md`      | Sonnet | 1 subclass per file (metadata only)                             |
| `feature-extraction.md`       | Sonnet | N features per subclass file                                    |
| `class-feature-extraction.md` | Sonnet | base-class features (one class, driven from its Level manifest) |
| `level-extraction.md`         | Sonnet | 20 levels per class file                                        |
| `feat-extraction.md`          | Sonnet | 1 feat per file                                                 |
| `background-extraction.md`    | Sonnet | 1 background per file                                           |
| `species-extraction.md`       | Sonnet | 1 species + its embedded subspecies + all traits                |
| `subspecies-extraction.md`    | Sonnet | shared sub-spec, applied within the species pass                |
| `trait-extraction.md`         | Sonnet | shared sub-spec, applied within the species pass                |
| `equipment-extraction.md`     | Sonnet | N items per table page (one record per row)                     |
| `magic-item-extraction.md`    | Sonnet | 1 magic item per file                                           |
| `poison-extraction.md`        | Sonnet | N poisons from the single poison table page                     |

**Extraction order matters** (due to cross-entity references):

1. Classes → Subclasses → Features (references subclasses) → Levels (references features)
2. Feats → Backgrounds (reference feats) → Species (emits species **and** its subspecies
   **and** all their traits, in one pass)

> Subspecies have no separate pages — they're embedded in each species page. So the species
> pass emits the Species **and** its Subspecies **and** all their Trait records in one pass,
> computing each child's slug once and reusing it for the parent's `subspecies[]` / `traits[]`
> ref — so refs and records can't diverge. `subspecies-extraction.md` and `trait-extraction.md`
> are shared rule sets applied within that pass, not standalone runs.

To run, ask Claude Code to dispatch extraction subagents in batches, e.g.:
_"extract all subclasses per `src/pipeline/prompts/subclass-extraction.md`, ~10 per subagent."_

Each subagent reads the spec + its batch of Markdown files and writes JSON records.
Existing outputs are skipped (resumable).

## Layout

```
src/pipeline/
├── config.ts              # site, categories, CLASS_NAMES, SUBCLASS_FLAVOR
├── crawl.ts               # stage 1 - crawlClasses(), crawlSubclasses(), crawl()
├── convert.ts             # stage 2 - HTML→Markdown with GFM tables
├── proficiencies.ts       # generates the authoritative 2024 proficiency reference set
├── conditions.ts          # generates conditions from 5e-database (not crawlable)
├── languages.ts           # generates languages from 5e-database (not crawlable)
├── validate.ts            # stage 4 - schema registry for all entity types
├── schemas/
│   ├── common-2024.ts     # shared APIReference + recursive ChoiceSchema
│   ├── spell-2024.ts      # SpellSchema
│   ├── class-2024.ts      # ClassSchema
│   ├── subclass-2024.ts   # SubclassSchema
│   ├── feature-2024.ts    # FeatureSchema
│   ├── level-2024.ts      # LevelSchema (with ClassSpecificSchema union)
│   ├── feat-2024.ts       # FeatSchema (tagged-union prerequisites)
│   ├── background-2024.ts # BackgroundSchema
│   ├── species-2024.ts    # SpeciesSchema
│   ├── subspecies-2024.ts # SubspeciesSchema
│   ├── trait-2024.ts      # TraitSchema (full 2014 trait_specific)
│   ├── proficiency-2024.ts # ProficiencySchema (authoritative 2024 reference set)
│   ├── equipment-2024.ts  # EquipmentSchema (base/mundane equipment)
│   ├── magic-item-2024.ts # MagicItemSchema
│   ├── condition-2024.ts  # ConditionSchema
│   ├── language-2024.ts   # LanguageSchema
│   └── poison-2024.ts     # PoisonSchema
└── prompts/
    ├── spell-extraction.md
    ├── class-extraction.md
    ├── subclass-extraction.md
    ├── feature-extraction.md
    ├── class-feature-extraction.md
    ├── level-extraction.md
    ├── feat-extraction.md
    ├── background-extraction.md
    ├── species-extraction.md
    ├── subspecies-extraction.md
    ├── trait-extraction.md
    ├── equipment-extraction.md   # table → one record per row
    ├── magic-item-extraction.md  # page → one record (spell-like)
    └── poison-extraction.md      # single table page → one record per row

data/
├── raw/                   # stage 1 output (HTML)
│   ├── spell/
│   ├── class/             # 12 files
│   ├── subclass/          # 62 files (class--slug.html naming)
│   ├── feat/
│   ├── background/
│   ├── species/           # subspecies are embedded in these pages, not crawled separately
│   ├── equipment/         # ~5 table pages (weapon/armor/adventuring-gear/tool/mounts)
│   ├── magic-item/        # ~390 per-item pages
│   └── poison/            # 1 table page (equipment:poison)
├── md/                    # stage 2 output (Markdown)
│   ├── spell/
│   ├── class/
│   ├── subclass/
│   ├── feat/
│   ├── background/
│   ├── species/
│   ├── equipment/
│   ├── magic-item/
│   └── poison/
└── out/                   # stage 3-4 output (JSON)
    ├── spell/
    ├── class/
    ├── subclass/
    ├── feature/
    ├── level/
    ├── feat/
    ├── background/
    ├── species/
    ├── subspecies/        # emitted during species extraction (no separate crawl/convert)
    ├── trait/             # emitted during species extraction
    ├── proficiency/       # generated by `npm run proficiencies` (not crawled)
    ├── condition/         # generated by `npm run conditions` (not crawled)
    ├── language/          # generated by `npm run languages` (not crawled)
    ├── equipment/         # one record per table row (+ category-grant extras)
    ├── magic-item/        # one record per page
    ├── poison/            # one record per row of equipment:poison
    └── 5e-SRD-*.json      # assembled arrays
```

## Subclass Discovery

Subclasses are discovered from class pages, not a central listing. The crawler:

1. Reads each class page (`<class>:main`)
2. Finds links matching `<class>:<slug>` pattern
3. Filters out auxiliary pages (spell-list, fighting-style, etc.) via `CLASS_AUXILIARY` regex
4. Saves as `data/raw/subclass/<class>--<slug>.html` (double-hyphen preserves parent context)

**62 subclasses discovered** across 12 classes (more than the ~48 estimated).

## Subspecies (embedded in species pages)

Unlike subclasses, subspecies are **not** separate wiki pages, so there's nothing to crawl or
convert. Each species page embeds its subspecies inline — e.g. the Elf page lists Drow / High
Elf / Wood Elf as an "Elven Lineages" section plus a benefits table; other pages use
"Lineages", "Legacies", or a "Subspecies" heading.

So subspecies follow the **same model as traits**: the species extraction pass
(`species-extraction.md`) emits the Species **and** each embedded Subspecies **and** all their
Traits in one pass, writing Subspecies records straight into `data/out/subspecies/`. They're
kept as separate entities (their own schema + `5e-SRD-Subspecies.json`); only the source is
shared. `subspecies-extraction.md` is the shared per-subspecies rule set applied within that
pass, not a standalone run.

## Model-change workflow

When an entity schema is updated (new fields, changed shape), the output JSON files for that
category must be regenerated from their source Markdown — not patched in-place. The LLM re-reads
the same Markdown with the updated extraction prompt and produces a fresh result, so the output
stays consistent with "Markdown + prompt → same JSON" as the invariant.

**Only re-extract the affected subset.** New fields are almost always additive, and most files
won't gain new data (a feature that's passive and unlimited needs no `activation` or `recharge`).
Re-extract only files where the new fields could be non-empty — look at the prompt rules to
identify those cases, then target those files. Running the full category is also safe (all stages
skip existing files by default), but deleting only the affected outputs is faster.

### Steps

1. **Update the schema** (`src/pipeline/schemas/<entity>-2024.ts`).
2. **Update the extraction prompt** (`src/pipeline/prompts/<entity>-extraction.md`) with new
   field rules, decision rules, and a worked example.
3. **Identify affected outputs** — files where the new fields would be non-empty:
   - Search the source Markdown for the triggering patterns (action phrases, recharge conditions,
     "choose one of the following" menus, …).
   - Delete only those `data/out/<entity>/<slug>.json` files.
4. **Re-extract** — run extraction subagents on the affected source files, using the updated
   prompt. Subagents re-read the Markdown cold (no peeking at the prior JSON); the prompt + source
   is the ground truth.
5. **Validate** — `npm run validate <entity>` to check schema conformance and referential
   integrity. No regressions means no prior field was dropped and all cross-references still resolve.

### Finding affected outputs (example: feature activation/recharge)

```sh
# Features that describe a Bonus Action activation
grep -rl "Bonus Action" data/md/subclass/ data/md/class/ | sort

# Features with a "Short or Long Rest" recharge
grep -rl "Short or Long Rest\|Short Rest\|Long Rest" data/md/subclass/ data/md/class/ | sort

# "choose one of the following benefits" features
grep -rl "choose one of the following" data/md/subclass/ data/md/class/ | sort
```

Each matching source file may produce multiple feature records; delete the outputs for all
features extracted from that file, then re-run extraction on it.

## Schema Notes

- **2014-compatible**: Schemas follow the 2014 5e-database structure for compatibility, diverging only where 2024 logic doesn't fit
- **Features / Traits / Subspecies are separate entities**: each gets its own schema and `5e-SRD-*.json`, even though Traits and Subspecies are extracted from their parent's source page (the source is shared; the entities are not embedded in the output)
- **Features (class + subclass)**: subclass features come from subclass pages; base-class features are driven from each class's Level manifest so their indexes match the Level→feature refs. A few mechanics that 6 classes reference by an identical bare index — Ability Score Improvement, Epic Boon, Subclass Feature, Expertise, Weapon Mastery — are single **classless** Feature records; class-specific ones like Spellcasting are per-class (`spellcasting-wizard`, …)
- **class_specific**: Discriminated union for per-class progression values (rage_count, ki_points, etc.)
- **Prerequisites**: Features take level/feature/spell/proficiency prerequisites; Feats use a tagged-union prerequisite keyed by `type` (level / ability_score / proficiency / feat / …)
- **2024 renames**: `races`/`subraces`/`racial_traits` → `species`/`subspecies`/`traits`
- **2024 drops/moves**: ability bonuses moved from species to backgrounds; backgrounds lost ideals/bonds/flaws/feature; backgrounds gained `ability_scores` + a granted `feat`
- **Proficiencies**: an authoritative 2024 reference set generated from the canonical 5e-database list (so indexes match it exactly — `cartographers-tools`, not `tool-cartographers-tools`), plus the 2024 proficiencies it lacks: the PHB category grants (`artisans-tools` / `gaming-set` / `musical-instrument`) and the Monk/Rogue weapon-property grants (`martial-weapons-light` / `martial-weapons-finesse`). Backgrounds/feats/traits/classes validate their proficiency refs against it (`validate.ts` loads it, falling back to the sparse shipped set only until it's built). `proficiencies.ts` also normalizes the one 5e-database equipment-slug drift (`cartographer-tools` → `cartographers-tools`) so tool `reference`s resolve against our equipment set
- **Equipment / Magic Items** (`equipment-2024.ts`, `magic-item-2024.ts`, modeled on 5e-database's schemas): base equipment is extracted from the wiki's **table** pages (one record per row); magic items from per-item **prose** pages (like spells). Items' `equipment_categories` / `properties` / `mastery` refs are baked into the extraction prompts from the canonical 5e-database taxonomies and validated against them. Equipment diverges from 5e-database where the 2024 wiki forces it: `cost` is **optional** (grouped items list "Varies"), tools carry an `ability`, and three grouped category-grant items (`artisans-tools` / `gaming-set` / `musical-instrument`) plus the mounts/vehicles categories 5e-database omits are added deliberately. Magic items keep `image` optional and default `variants` to `[]` (the wiki lists sub-variants inline, not as separate pages)

## Referential integrity

`src/pipeline/__tests__/referential-integrity.test.ts` walks **every** `{ index, url }`
reference in every assembled `5e-SRD-*.json` — including those nested inside Choices
(option items, `trait_specific`, `subtrait_options`, …) — and asserts each resolves to an
entity that actually exists. This guards against slug drift between a reference and its
target (a renamed subspecies, an apostrophe-slug spell, a feat prerequisite pointing at a
feat that was never extracted).

There are **no documented gaps** — every reference in the assembled output resolves:

- The **Equipment** gap (background/class equipment options + tool `reference`s — ~427 refs) was closed by the `equipment` + `magic-items` datasets. Equipment items' own `equipment-categories` / `weapon-properties` / `weapon-mastery-properties` refs resolve against the canonical 5e-database lists; the mounts/vehicles categories 5e-database omits (`mounts-and-vehicles`, …) are coined deliberately and kept in sync between `validate.ts` (`EXTRA_EQUIPMENT_CATEGORIES`) and the integrity test.
- The **Artificer** gap (~80 spell→class refs) was closed by **stripping the non-PHB Artificer class during assembly** (`validate.ts` `stripArtificer`): per-item spell files keep Artificer faithfully, but the aggregated `5e-SRD-Spells.json` is PHB-only (and a spell whose only class is Artificer — Homunculus Servant — is dropped from the assembled output).

## Known gaps for a character builder

The dataset now covers the **full PHB character-creation spine** — **species → background →
class → subclass → level 1-20** — with every selection data-driven: skill/equipment/feat
**choices**, spell slots + `spells_known`, a class-filtered spell list (`spell.classes`), and the
in-entity option picks (Fighting Style / Expertise / Weapon Mastery, the PHB feat choices, and the
Eldritch Invocation / Metamagic / Maneuver catalogs). **No PHB data gaps remain** — every reference
resolves. The only deliberately-unpopulated choices are **non-PHB feat choices** (Eberron
dragonmarks, epic boons, setting feats) — out of scope for the PHB build.

> **Recently closed (all of the former gaps):**
>
> - `feature_specific` for **Fighting Style / Expertise / Weapon Mastery** (9 features) and
>   `choices` for the **16 PHB origin/general choice feats** — the options are closed taxonomies
>   that already exist as entities (fighting-style feats, skill proficiencies, mastery weapons,
>   ability scores, damage types, tools/instruments), so the extraction prompts carry those option
>   tables and each subagent reads the prose to emit the pick (count, target set, melee-only filter,
>   `resource_list` for parameterized spell picks).
> - **Eldritch Invocations / Metamagic / Maneuvers** — the option lists weren't on the crawled
>   class pages (they're separate wiki pages), so two single-page crawls (`invocations`, `metamagic`)
>   were added; the picks are now **58 parent-linked Feature records** (28 / 10 / 20) and the parent
>   feature (`eldritch-invocations`, `metamagic`, `battle-master-3-combat-superiority`) lists them in
>   `feature_specific` (`invocations[]` / `subfeature_options`).
> - `spells_known` on all **160** caster level-records, re-extracted from each class table's
>   "Prepared Spells" column into `level.spellcasting.spells_known`.
>
> Every coined `{index,url}` resolves against our assembled sets (the referential-integrity test
> walks them).

Minor (UI/global rules, not data gaps): language choice is the global 2024 origin rule
("Common + 2 of choice" — not per-background; use the new `languages` set to populate the picker);
the small reference taxonomies a builder also needs — **Skills with their ability mapping**,
Ability-Scores, Damage-Types, Alignments — aren't regenerated into `data/out`, so consume them
directly from `node_modules/5e-database/src/2024/en/`; HP/AC/point-buy are computed by the UI from
inputs already present (`hit_die`, ability scores, equipment `armor_class`).

## Next steps

Remaining optional content is out of scope for the PHB build:

- **Artificer class** — the wiki hosts it (`/artificer:main` + subclasses + spell list); crawl/extract it as a 13th class if you want Artificer back in the dataset, then remove `stripArtificer`.
- **Non-PHB feat `choices`** — dragonmarks, epic boons, and setting feats carry their picks only in `desc`. The `choices` machinery is in place (`feat-2024.ts` + the "Option choices" rules in `feat-extraction.md`); populate them the same way if you build beyond the PHB.
- **Monsters** — Monster Manual content, a separate effort.

- The crawler fetches with rate limiting (500ms between requests for classes/subclasses)
- Tables are converted using `turndown-plugin-gfm` for proper markdown table format
- The wiki 301-redirects `https→http`; the crawler follows it
- 2024 rules content is © Wizards of the Coast; the wiki is community-maintained
