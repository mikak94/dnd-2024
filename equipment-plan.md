# Equipment + Magic Items dataset

## Context

This repo builds an authoritative 2024 D&D SRD from `dnd2024.wikidot.com` via a 4-stage
pipeline (crawl → convert → extract → validate) with Zod schemas + a whole-dataset
referential-integrity test. Equipment is the **largest open gap**: ~427 references from
backgrounds, classes (`starting_equipment` / `starting_equipment_options`) and tool
proficiency `reference`s point at `/api/2024/equipment/<index>`, but no equipment dataset
exists, so the integrity test carries a documented `equipment` / `equipment-categories`
exception (`referential-integrity.test.ts:119-153`, README "Next steps" item 1).

Goal: build **base equipment** and **magic items** by crawling the wiki (not deriving from
`5e-database`), then wire both into validation and close the equipment integrity gap.

Decisions confirmed with the user: **source = crawl the wiki**; **scope = base equipment +
magic items**.

## Key finding — the wiki stores equipment in two different shapes

Probed the live wiki. Equipment is **not** one-page-per-item like spells:

- **Base/mundane equipment = table pages** under the `equipment:` namespace, reachable from
  the `/equipment:all` hub. Each page is many items as table rows:
  - `equipment:weapon` — 7 tables (Simple/Martial × Melee/Ranged). Cols: Name, Damage,
    Properties, Mastery, Weight, Cost.
  - `equipment:armor` — Light/Medium/Heavy/Shield tables (AC, Strength min, Stealth, Weight, Cost).
  - `equipment:adventuring-gear` — 1 table, ~91 items. Cols: Item, Weight, Cost, Function (desc).
  - `equipment:tool` — Artisan / Other / Gaming Sets / Musical Instruments. Cols: Name, Ability, Weight, Cost.
  - `equipment:mounts-and-vehicles` — tables.
  - Also `equipment:` {currency, crafting, trinket, poison} — exclude (coins/rules/flavor; poison overlaps gear).
- **Magic items = one page per item** under the `magic-item:` namespace, listed on
  `/magic-item:all` (~390 item links across 7 tables). Spell-like prose pages.

So stage-3 extraction needs **two prompts of different shapes**: a _table→many-records_
prompt for base equipment, and a _page→one-record_ prompt for magic items (like spells).

## Schemas to mirror (already bundled, do not import — model ours on them)

- Base equipment: `node_modules/5e-database/src/2024/schemas/5e-SRD-Equipment.ts`
  (index, name, equipment_categories[], cost{quantity,unit}, weight?, damage?, two_handed_damage?,
  range?, throw_range?, properties[]?, mastery?, armor_class{base,dex_bonus,max_bonus?}?,
  str_minimum?, stealth_disadvantage?, contents[]?, description?, …).
- Magic items: `node_modules/5e-database/src/2024/schemas/5e-SRD-Magic-Items.ts`
  (index, name, equipment_category (APIRef), rarity{name}, attunement(bool), desc(string),
  variant(bool), variants(APIRef[]), image, `limited-to`?).

Reuse `APIReferenceSchema`, `DamageSchema`, `DifficultyClassSchema` from
`src/pipeline/schemas/common-2024.ts` — do **not** redefine them.

## Reference taxonomies (baked into prompts, validated against 5e-database)

Like the spell prompt bakes in damage-type/school/class tables, the equipment prompts bake in
exact reference objects for the closed taxonomies, all shipped by `5e-database`:

- `5e-SRD-Equipment-Categories.json` (30) → `/api/2024/equipment-categories/<index>`
- `5e-SRD-Weapon-Properties.json` → `/api/2024/weapon-properties/<index>`
- `5e-SRD-Weapon-Mastery-Properties.json` → `/api/2024/weapon-mastery-properties/<index>`
- damage-types (already a shipped ref set).

## Implementation

### 1. Crawl config — `src/pipeline/config.ts`

Add two `CATEGORIES` entries (stages 1-2 are category-agnostic, so crawl/convert need no other change):

```ts
equipment:    { name: "equipment",  listing: "/equipment:all", prefix: "equipment",
                exclude: /^(all|currency|crafting|trinket|poison)$/ },
"magic-items":{ name: "magic-item", listing: "/magic-item:all", prefix: "magic-item",
                exclude: /^all$/ },
```

`npm run crawl equipment` then fetches the ~5 category pages; `npm run crawl magic-items`
fetches ~390 item pages. `extractSlugs` + the existing resumable/rate-limited `crawl()` handle both.

### 2. Convert — no change

`npm run convert equipment` / `npm run convert magic-items`. The generic `htmlToMarkdown`
already emits GFM tables (base equipment) and prose (magic items).

### 3. Schemas

- `src/pipeline/schemas/equipment-2024.ts` — `EquipmentSchema` (`z.strictObject`, `z.infer`),
  modeled on the 5e-database equipment schema, reusing common-2024 sub-schemas.
- `src/pipeline/schemas/magic-item-2024.ts` — `MagicItemSchema`, modeled on the 5e-database
  magic-items schema. `url` → `/api/2024/magic-items/<index>`.

### 4. Extraction prompts — `src/pipeline/prompts/`

- `equipment-extraction.md` (table→records): for each `data/md/equipment/<page>.md`, emit one
  `data/out/equipment/<item-slug>.json` per table row. Encode: column→field maps per page type;
  slug = kebab-case of name; cost parse ("1 SP" → `{quantity:1,unit:"sp"}`, GP/SP/CP/EP/PP);
  weight parse ("1/4 lb." → 0.25); weapon damage → `DamageSchema`, Versatile → `two_handed_damage`,
  Thrown/Ammunition "(Range x/y)" → `range`/`throw_range`; Properties/Mastery → APIRefs from the
  baked tables; armor → `armor_class`/`str_minimum`/`stealth_disadvantage`;
  `equipment_categories` assigned per table; packs → `contents[]`. Include exact reference tables.
- `magic-item-extraction.md` (page→record, spell-like): index, name, `equipment_category`,
  `rarity.name`, `attunement`, `desc`, `variant`/`variants`. Mirror the spell prompt's structure
  (input layout, output shape, field rules, worked example).

### 5. Validation — `src/pipeline/validate.ts`

- Add shipped ref sets: `SHIPPED_EQUIPMENT_CATEGORIES`, `SHIPPED_WEAPON_PROPERTIES`,
  `SHIPPED_WEAPON_MASTERY` (via existing `shippedIndexes(...)`).
- `checkEquipmentRefs`: url/index match; `cost.unit` ∈ {cp,sp,ep,gp,pp}; categories/properties/
  mastery indexes in their shipped sets; `damage.damage_type` in `SHIPPED_DAMAGE_TYPES`;
  `contents[].item` resolve within the equipment set.
- `checkMagicItemRefs`: url/index match; `equipment_category` in shipped categories; `rarity.name`
  in the allowed set; `variants` resolve within the magic-item set.
- Register `equipment` and `magic-items` in `REGISTRY` (folder/output `5e-SRD-Equipment.json`,
  `5e-SRD-Magic-Items.json`), and add both to the `Entity` union.

### 6. Integrity test — `src/pipeline/__tests__/referential-integrity.test.ts`

- `OUR`: add `equipment: "Equipment"`, `"magic-items": "Magic-Items"`.
- `SRD_REF`: add `"equipment-categories": "Equipment-Categories"`,
  `"weapon-properties": "Weapon-Properties"`, `"weapon-mastery-properties": "Weapon-Mastery-Properties"`.
- **Remove** the `equipment` / `equipment-categories` gap block (lines ~119-125) and its
  `gaps.equipment` "still live" assertion (~151). Keep the Artificer gap.

### 7. Tests — `src/pipeline/__tests__/equipment.test.ts`, `magic-items.test.ts`

Mirror `proficiencies.test.ts`/`spells.test.ts`: `describe.skipIf(!existsSync(file))`, asserts
records exist, every record matches the schema, indexes unique.

### 8. Reconcile the original 117 equipment references

Backgrounds/classes/proficiencies reference 117 distinct equipment indexes (100 match the
5e-database naming; ~17 differ). After extraction, run the integrity test and resolve every
unresolved `equipment/<index>` by either fixing slug drift in the crawled records or adding the
grouped/category items the wiki lists generically (e.g. `arcane-focus`, `holy-symbol`,
`gaming-set`, `musical-instrument`, `artisans-tools`) — the same kind of reconciliation
`proficiencies.ts`'s `EXTRA[]` did. The integrity test is the completion signal.

### 9. README

Update the gap table + "Next steps" (drop the equipment gap, keep Artificer), add equipment &
magic-items to category lists, and document the two extraction shapes (table vs. page).

## Verification

1. `npm run crawl equipment && npm run convert equipment` → category `.md` files exist with tables.
2. `npm run crawl magic-items && npm run convert magic-items` → ~390 `.md` files.
3. Run the two extraction passes (Claude subagents) → per-item JSON in `data/out/equipment/` and `data/out/magic-item/`.
4. `npm run validate equipment` and `npm run validate magic-items` → 0 errors; assembles
   `5e-SRD-Equipment.json` / `5e-SRD-Magic-Items.json`.
5. `npm test` → schema + uniqueness tests pass; **referential-integrity passes with the
   equipment exception removed** (every background/class/tool equipment ref now resolves).
6. Spot-check a weapon (longsword: damage 1d8, versatile two_handed 1d10, mastery sap), armor
   (leather: base 11 dex_bonus), a pack (`contents[]`), and a magic item (rarity + attunement).
