# Magic Item extraction spec (2024)

Convert D&D 2024 magic-item pages — scraped from dnd2024.wikidot.com as Markdown in
`data/md/magic-item/<slug>.md` — into one structured JSON record each, written to
`data/out/magic-item/<slug>.json`. Extract only what the text states; never invent values.

This is **one page → one record** (like spells). Base/mundane equipment is a separate,
table-based pass (`equipment-extraction.md`).

Schema: `src/pipeline/schemas/magic-item-2024.ts`. Validate after with `npm run validate magic-items`.

## How a subagent runs a batch

Each subagent is given a list of slugs. For every slug, **using Claude Sonnet**:

1. Read `data/md/magic-item/<slug>.md`.
2. Produce the JSON object per the rules below.
3. Write it to `data/out/magic-item/<slug>.json` (pretty-printed, trailing newline).
4. Skip if the output file already exists (resumable).

Output **only** the JSON object — no prose, no Markdown fences in the file.

## Input layout

```
# <Item Name>

Source: Dungeon Master's Guide

_<Category descriptor>, <Rarity>[ (Requires Attunement[ by a ...])]_

<body paragraphs, optionally with a variant/rarity table>
```

The single italic line under Source carries the **category**, **rarity**, and **attunement**.
Examples:

- `_Wondrous Item, Uncommon_`
- `_Armor (Any Medium or Heavy, Except Hide Armor), Uncommon_`
- `_Weapon (Any Melee Weapon), Rare (Requires Attunement)_`
- `_Wondrous Item, Rarity Varies (Requires Attunement)_`
- `_Scroll, Rarity Varies_`
- `_Ring, Legendary (Requires Attunement by a ...)_`

A few pages (e.g. Potion of Healing) have **two** `Source` + italic blocks (PHB and DMG). Use
the **last (DMG)** block for `equipment_category`/`rarity`/`attunement`, and concatenate both
bodies into `desc`.

## Output shape

```json
{
  "index": "flame-tongue",
  "name": "Flame Tongue",
  "equipment_category": {
    "index": "weapons",
    "name": "Weapons",
    "url": "/api/2024/equipment-categories/weapons"
  },
  "rarity": { "name": "Rare" },
  "attunement": true,
  "desc": "While holding this magic weapon, you can take a Bonus Action ...",
  "variant": false,
  "variants": [],
  "url": "/api/2024/magic-items/flame-tongue"
}
```

## Field rules

- **name** — the H1 text, verbatim (curly quotes/apostrophes normalized to ASCII).
- **index** — the slug of the source file (matches the page slug, e.g. `flame-tongue`). Do not
  recompute from the name (the wiki slug is authoritative, e.g. `heward-s-handy-haversack`).
- **url** — `/api/2024/magic-items/<index>`.
- **equipment_category** — map the **leading word(s)** of the italic line (before the first
  `(` or `,`) to **one** equipment-categories ref (table below). `Armor`→`armor`,
  `Weapon`→`weapons`, `Ammunition`→`weapons`, `Ring`→`rings`, `Potion`/`Oil`→`potions`,
  `Wand`→`wands`, `Staff`→`staffs`, and **everything else** (`Wondrous Item`, `Scroll`, `Rod`,
  …) → `wondrous-items`.
- **rarity** — `{ "name": <rarity> }` from the italic line, after the category and before any
  `(Requires Attunement)`. Keep one of `Common`, `Uncommon`, `Rare`, `Very Rare`, `Legendary`,
  `Artifact`; normalize `Rarity Varies` → `Varies`. (If the line gives a compound rarity, use
  `Varies`.)
- **attunement** — `true` if `Requires Attunement` appears in the italic line (with or without a
  `by a ...` qualifier), else `false`.
- **desc** — all body paragraphs after the italic line, joined with `\n\n`. Strip Markdown
  emphasis markers (`**`, `_`) but keep bold inline labels (`**Curse.** ...` → `Curse. ...`).
  Keep any variant/rarity **table** as GFM Markdown inside the string. Normalize curly
  quotes/apostrophes to ASCII. Drop "Table of Contents"/Fold/Unfold navigation lines if present.
- **variant** — `false` for essentially all pages (set `true` only if the page text explicitly
  states this item is a variant of a named parent item that has its own page).
- **variants** — `[]` unless the body links to **separate** `/magic-item:<slug>` pages presented
  as named variants of this item; then list each as a magic-items ref
  `{ "index": <slug>, "name": <Name>, "url": "/api/2024/magic-items/<slug>" }`. Inline
  variant _tables_ (e.g. Belt of Giant Strength's hill/frost/…) are **not** separate pages —
  keep those in `desc` and leave `variants: []`.
- **limited-to** — include only if the item is explicitly restricted to a single class
  (e.g. `"Wizard"`); otherwise omit.
- **image** — omit (the wiki carries none).

## Exact equipment-category references

`{ "index": <idx>, "name": <Name>, "url": "/api/2024/equipment-categories/<idx>" }`

| Leading descriptor on italic line    | index            | name           |
| ------------------------------------ | ---------------- | -------------- |
| Armor                                | `armor`          | Armor          |
| Weapon / Ammunition                  | `weapons`        | Weapons        |
| Potion / Oil                         | `potions`        | Potions        |
| Ring                                 | `rings`          | Rings          |
| Wand                                 | `wands`          | Wands          |
| Staff                                | `staffs`         | Staffs         |
| Wondrous Item / Scroll / Rod / other | `wondrous-items` | Wondrous Items |

## Worked example

Input (`data/md/magic-item/adamantine-armor.md`):

```
# Adamantine Armor

Source: Dungeon Master's Guide

_Armor (Any Medium or Heavy, Except Hide Armor), Uncommon_

This suit of armor is reinforced with adamantine, one of the hardest substances in existence. While you're wearing it, any Critical Hit against you becomes a normal hit.
```

Output (`data/out/magic-item/adamantine-armor.json`):

```json
{
  "index": "adamantine-armor",
  "name": "Adamantine Armor",
  "equipment_category": {
    "index": "armor",
    "name": "Armor",
    "url": "/api/2024/equipment-categories/armor"
  },
  "rarity": { "name": "Uncommon" },
  "attunement": false,
  "desc": "This suit of armor is reinforced with adamantine, one of the hardest substances in existence. While you're wearing it, any Critical Hit against you becomes a normal hit.",
  "variant": false,
  "variants": [],
  "url": "/api/2024/magic-items/adamantine-armor"
}
```
