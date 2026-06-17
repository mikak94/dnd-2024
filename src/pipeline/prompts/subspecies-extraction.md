# Subspecies extraction spec (2024) — shared sub-spec

This is **not** run as a standalone category, and subspecies have **no separate wiki pages**.
Each species page embeds its subspecies inline — e.g. the Elf page lists Drow / High Elf /
Wood Elf as an "Elven Lineages" section + table; other pages call them "Lineages",
"Legacies", or a "Subspecies" section. (An _"Ancestry" choice_ that only parameterizes one
trait — Dragonborn's Draconic Ancestry, Goliath's Giant Ancestry — is **not** a subspecies;
it's a trait. See `species-extraction.md`'s `subspecies` rule.) This spec defines the per-Subspecies field rules
applied **within** the species pass (see `species-extraction.md`): when an agent extracts a
species, it emits that species' subspecies in the same pass, writing each to
`data/out/subspecies/<subspecies-index>.json`, and emits each subspecies' traits per
`trait-extraction.md`. Running it inside the species pass is what guarantees the species'
`subspecies[]` refs and the Subspecies records share one slug. Extract only what the text
states; never invent values.

Schemas: `src/pipeline/schemas/subspecies-2024.ts` + `src/pipeline/schemas/trait-2024.ts`.
Validate after with `npm run validate subspecies` and `npm run validate trait`.

## Deterministic slug rule (MUST match the parent species' `subspecies[]` refs)

`slugify(s)`: lowercase; replace each run of non-alphanumeric characters with a single `-`;
trim leading/trailing `-`. E.g. "High Elf" → `high-elf`.

A subspecies' **index** is `slugify(<subspecies name>)`. The parent species record's
`subspecies[]` entry MUST be `{ "index": "<that index>", "name": "<subspecies name>",
"url": "/api/2024/subspecies/<that index>" }`. The parent species index comes from the
species page being extracted (NOT from any filename).

## Output shape (Subspecies)

```jsonc
{
  "index": "high-elf",
  "name": "High Elf",
  "species": { "index": "elf", "name": "Elf", "url": "/api/2024/species/elf" },
  "desc": [
    "High elves have been infused with the magic of crossings between the Feywild and the Material Plane...",
  ],
  "traits": [
    {
      "index": "high-elf-cantrip",
      "name": "Cantrip",
      "url": "/api/2024/traits/high-elf-cantrip",
    },
  ],
  "url": "/api/2024/subspecies/high-elf",
}
```

## Field rules

- **name** — the subspecies/lineage name as written on the species page, verbatim.
  **index** — `slugify(name)`, e.g. "High Elf" → `high-elf`.
- **species** — the parent species ref (the species page being extracted):
  `{ "index": "<species>", "name": "<Species>", "url": "/api/2024/species/<species>" }`.
- **desc** — the subspecies' flavor + benefit prose as an array of strings. Pull from both the
  flavor blurb and any per-lineage row/section (e.g. the "Drow" row of the Elven Lineages
  table). Strip Markdown emphasis.
- **traits** — one ref per distinct mechanical benefit the subspecies grants beyond the
  species' shared traits (e.g. a lineage's per-level spells / speed boost), using the
  deterministic trait slug `<subspecies-index>-slugify(<trait name>)`, each
  `{ index, name, url:/api/2024/traits/<index> }`. The matching Trait records are emitted in
  this same pass and carry the subspecies in their `subspecies[]` field. Use `[]` when the
  page describes the subspecies as pure flavor with no separable benefit.
  - **Naming (lineage/legacy subspecies):** when the subspecies comes from a "Choose a
    lineage/legacy" trait on the species page (Elf's _Elven Lineage_, Tiefling's _Fiendish
    Legacy_, Gnome's _Gnomish Lineage_), name the subspecies' granted trait with that **same
    species-trait name** — so for Elf every lineage's benefit trait is named `"Elven Lineage"`
    with slug `<subspecies-index>-elven-lineage` (e.g. `drow-elven-lineage`). Do **not** invent
    a label like "Lineage Benefit".
  - **`parent` ref:** that granted trait MUST set `parent` to the species-level lineage/legacy
    trait it rolls up under (e.g. `drow-elven-lineage` → `parent: elf-elven-lineage`), per
    `trait-extraction.md`.
  - **`desc` (per-level benefits):** capture every level entry from the lineage/legacy table
    row. When the species trait states a general rule for those spells (e.g. "you always have
    that spell prepared; you can cast it once without a slot per Long Rest, and can also use
    spell slots"), apply that rule to each listed spell in the trait `desc`, and include the
    spellcasting-ability choice line if the species states one.
- **url** — `/api/2024/subspecies/<index>`.

Note: 2024 subspecies carry NO ability bonuses (ASIs moved to backgrounds) — there is no such field.

## Worked example

A species page (`data/md/species/elf.md`) contains an "Elven Lineages" section/table:

```
##### High Elves
High elves have been infused with the magic of crossings between the Feywild and the Material Plane...

##### Elven Lineages
| Lineage  | Level 1 | Level 3 | Level 5 |
| ---      | ---     | ---     | ---     |
| High Elf | You know the Prestidigitation cantrip... | Detect Magic | Misty Step |
```

While extracting the Elf species, also emit `data/out/subspecies/high-elf.json`:

```json
{
  "index": "high-elf",
  "name": "High Elf",
  "species": { "index": "elf", "name": "Elf", "url": "/api/2024/species/elf" },
  "desc": [
    "High elves have been infused with the magic of crossings between the Feywild and the Material Plane.",
    "Level 1: You know the Prestidigitation cantrip. Whenever you finish a Long Rest, you can replace that cantrip with a different cantrip from the Wizard spell list. Level 3: Detect Magic. Level 5: Misty Step."
  ],
  "traits": [
    {
      "index": "high-elf-elven-lineage",
      "name": "Elven Lineage",
      "url": "/api/2024/traits/high-elf-elven-lineage"
    }
  ],
  "url": "/api/2024/subspecies/high-elf"
}
```

Plus `data/out/trait/high-elf-elven-lineage.json` per `trait-extraction.md`, named `"Elven Lineage"`
(matching the species' lineage trait), with `"parent": { "index": "elf-elven-lineage", "name":
"Elven Lineage", "url": "/api/2024/traits/elf-elven-lineage" }` and `"subspecies": [{ "index":
"high-elf", "name": "High Elf", "url": "/api/2024/subspecies/high-elf" }]`. The Elf species record
lists this subspecies in its `subspecies[]`.
