# Species extraction spec (2024)

Convert D&D 2024 species pages — scraped from dnd2024.wikidot.com as Markdown in
`data/md/species/<slug>.md` — into **one Species record plus its Subspecies records plus all
their Trait records**, in a single pass. **Subspecies have no separate wiki pages**: each
species page embeds them inline (e.g. the Elf page's "Elven Lineages" section + table; other
pages use "Lineages", "Legacies", or a "Subspecies" heading). So this one pass produces every
Species, Subspecies, and Trait — there is no separate subspecies crawl, convert, or pass.
Write the Species to `data/out/species/<species-index>.json`, each Subspecies to
`data/out/subspecies/<subspecies-index>.json` (per `subspecies-extraction.md`), and each Trait
to `data/out/trait/<trait-index>.json` (per `trait-extraction.md`). Extract only what the text
states; never invent values.

Schemas: `src/pipeline/schemas/species-2024.ts` + `subspecies-2024.ts` + `trait-2024.ts`.
Validate after with `npm run validate species`, `npm run validate subspecies`, and
`npm run validate trait`.

## How a subagent runs a batch

Each subagent is given a list of filenames. For every file, **using Claude Sonnet**

1. Read `data/md/species/<filename>.md`.
2. Emit the Species record (rules below). For each named trait on the page, emit a Trait
   record per `trait-extraction.md`, computing its slug ONCE and reusing that exact slug for
   the Species `traits[]` ref — so ref and record can't diverge.
3. For each subspecies/lineage embedded on the page, emit a Subspecies record per
   `subspecies-extraction.md` (and any traits it grants per `trait-extraction.md`), again
   computing each slug ONCE and reusing it for the Species `subspecies[]` ref.
4. Write the Species to `data/out/species/<species-index>.json`, each Subspecies to
   `data/out/subspecies/<subspecies-index>.json`, and each Trait to
   `data/out/trait/<trait-index>.json` (pretty-printed, trailing newline).
5. Skip a file whose outputs you've already written (resumable).

Output **only** the JSON object per file — no prose, no Markdown fences.

## Input layout

```
# <Species Name>

Source: Player's Handbook

<Intro flavor paragraphs>

**Creature Type:** Humanoid
**Size:** Medium (or Small) — <size description>
**Speed:** 30 feet

### <Trait Name>
<Trait description>

### <Trait Name>
<Trait description>

<Optional "Lineages"/"Legacies"/"Subspecies" section + table embedding the subspecies>
```

The subspecies (when present) are NOT a separate file — they live in this same page, typically
as a flavor section per variant plus a benefits table. Extract them in this pass.

## Output shape (Species)

```jsonc
{
  "index": "dragonborn",
  "name": "Dragonborn",
  "size": "Medium", // OR omit and use size_options when the page offers a size choice
  "size_options": null, // a Choice when size is chosen (e.g. Small or Medium); omit otherwise
  "size_description": "...", // optional
  "speed": 30,
  "type": "Humanoid",
  "age": "...", // optional
  "traits": [
    {
      "index": "dragonborn-draconic-ancestry",
      "name": "Draconic Ancestry",
      "url": "/api/2024/traits/dragonborn-draconic-ancestry",
    },
    {
      "index": "dragonborn-breath-weapon",
      "name": "Breath Weapon",
      "url": "/api/2024/traits/dragonborn-breath-weapon",
    },
  ],
  "subspecies": [], // refs to subspecies entities if the page lists them
  "url": "/api/2024/species/dragonborn",
}
```

## Field rules

- **name** — the H1 text, verbatim. **index** — `slugify(name)`, e.g. "Dragonborn" → `dragonborn`.
- **size** — the fixed size string (e.g. "Medium") when the species has one. If size is a
  choice (e.g. "Small or Medium"), OMIT `size` and set **size_options** to a `Choice` whose
  options are `{ "option_type": "size", "size": "Small" }` etc. Exactly one of the two is present.
- **size_description** — the size flavor sentence, if present. Omit otherwise.
- **speed** — walking speed in feet, as a number.
- **type** — the Creature Type (e.g. "Humanoid").
- **age** — age flavor text if present; omit otherwise.
- **traits** — one ref per named trait section, using the deterministic trait slug
  `<species-index>-slugify(<trait name>)`. Each is `{ index, name, url:/api/2024/traits/<index> }`.
- **subspecies** — one ref per subspecies/lineage embedded on the page (or `[]` if the species
  has none). Index = `slugify(subspecies name)`, url `/api/2024/subspecies/<index>`. Emit the
  matching Subspecies records in this same pass per `subspecies-extraction.md`, reusing the
  exact slug — so ref and record can't diverge.
  - **Subspecies** = named _variants of the species_ you pick at creation: a "Lineage"/"Legacy"
    table or named subspecies sections (e.g. Elf → Drow/High Elf/Wood Elf; Tiefling →
    Abyssal/Chthonic/Infernal; Gnome → Forest/Rock). Each becomes a Subspecies record.
  - **NOT subspecies:** an _"Ancestry" choice_ that only parameterizes a single trait (e.g.
    Dragonborn's **Draconic Ancestry** picks the breath-weapon damage type; Goliath's **Giant
    Ancestry** picks a boon). Model these as a **trait** (with `trait_specific` / a `Choice`),
    leave `subspecies: []`, and do not emit Subspecies records for them.
  - Most species have neither — `subspecies: []` is the common case (2024 removed most subraces).
- **url** — `/api/2024/species/<index>`.

Note: 2024 species carry NO ability bonuses, alignment, or direct languages — there are no
such fields (ability boosts come from backgrounds; languages from the Origin).

## slugify

`slugify(s)`: lowercase; replace each run of non-alphanumeric characters with a single `-`;
trim leading/trailing `-`. E.g. "Draconic Ancestry" → `draconic-ancestry`.

## Worked example

Input (`data/md/species/dragonborn.md`):

```
# Dragonborn

Source: Player's Handbook

Dragonborn look very much like dragons standing erect in humanoid form...

**Creature Type:** Humanoid
**Size:** Medium (about 5–7 feet tall)
**Speed:** 30 feet

### Draconic Ancestry
Your lineage stems from a dragon. Choose a kind of dragon from the Draconic Ancestry table...

### Breath Weapon
When you take the Attack action on your turn, you can replace one attack with an exhalation...

### Darkvision
You have Darkvision with a range of 60 feet.
```

Output (`data/out/species/dragonborn.json`):

```json
{
  "index": "dragonborn",
  "name": "Dragonborn",
  "size": "Medium",
  "size_description": "about 5–7 feet tall",
  "speed": 30,
  "type": "Humanoid",
  "traits": [
    {
      "index": "dragonborn-draconic-ancestry",
      "name": "Draconic Ancestry",
      "url": "/api/2024/traits/dragonborn-draconic-ancestry"
    },
    {
      "index": "dragonborn-breath-weapon",
      "name": "Breath Weapon",
      "url": "/api/2024/traits/dragonborn-breath-weapon"
    },
    {
      "index": "dragonborn-darkvision",
      "name": "Darkvision",
      "url": "/api/2024/traits/dragonborn-darkvision"
    }
  ],
  "subspecies": [],
  "url": "/api/2024/species/dragonborn"
}
```

Plus one Trait file per entry above (`data/out/trait/dragonborn-draconic-ancestry.json`,
`dragonborn-breath-weapon.json`, `dragonborn-darkvision.json`) following `trait-extraction.md`.

Dragonborn has `"subspecies": []`. For a species with embedded subspecies — e.g. Elf's Drow /
High Elf / Wood Elf lineages — `subspecies[]` would list each one, and the pass would also emit
`data/out/subspecies/<index>.json` per `subspecies-extraction.md` (see its worked example).
