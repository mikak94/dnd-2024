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
  `Wand`→`wands`, `Staff`→`staffs`, `Scroll`→`scrolls`, and **everything else** (`Wondrous Item`,
  `Rod`, …) → `wondrous-items`.
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
- **limited-to** — include only if the item is explicitly restricted to a single class,
  **including via "Requires Attunement by a &lt;Class&gt;"** (e.g. Holy Avenger's "by a Paladin"
  → `"Paladin"`). A restriction by species/ancestry (e.g. "by a Dwarf") or by a broad capability
  ("by a Spellcaster") is NOT a single class — omit `limited-to` for those. Otherwise omit.
- **combat** — present for every item that modifies a base **weapon, ammunition, armor, or
  shield** (see the dedicated section below): always set `applies_to`, and add the numeric
  fields when the text states them. Omit `combat` entirely for the non-combat categories
  (Wondrous Items, Rings, Potions, Staffs, Wands).
- **image** — omit (the wiki carries none).

## Combat effects (`combat`) — weapons, ammunition, armor, shields

A magic weapon/armor item is a **modifier applied to a base item the wielder picks** (the
italic line's parenthetical, e.g. `(Any Melee Weapon)`, `(Any Light, Medium, or Heavy)`). Always set `applies_to`; fill the rest with only the **numeric** effects the text states (leave
resistances, set-AC, extra languages, curses, and other riders in `desc`). An item with no
numeric effect still gets `combat` with just `applies_to` (e.g. Armor of Resistance →
`{ "applies_to": "armor" }`); the Resistance stays in `desc`.

Shape:

```json
"combat": {
  "applies_to": "weapon" | "ammunition" | "armor" | "shield",
  "attack_bonus": 1,            // optional, flat +N to attack rolls
  "damage_bonus": 1,            // optional, flat +N to damage rolls
  "ac_bonus": 1,                // optional, flat +N to Armor Class
  "scales_with_rarity": true,   // optional, ONLY the generic "+1, +2, or +3" items
  "extra_damage": [             // optional
    { "dice": "2d6", "damage_type": { "index": "fire", "name": "Fire", "url": "/api/2024/damage-types/fire" } }
  ]
}
```

**Unconditional only.** Every numeric field (`attack_bonus`, `damage_bonus`, `ac_bonus`,
`extra_damage`) captures a **flat, always-on** effect — one that applies to every attack/hit (or
to AC at all times) with no trigger. **Leave conditional effects in `desc`** (do not model them):

- extra damage or a bonus that applies **only against a creature type** (Dragon, Giant, Undead,
  Fiend, Humanoid, Construct, …) — e.g. Dragon Slayer's "+3d6 vs a Dragon", Holy Avenger's
  "+2d10 vs a Fiend or Undead".
- damage that triggers **only on a Critical Hit or a roll of 20** (Sword of Sharpness, Mace of
  Smiting's bonus-vs-Construct), or a flat number rather than dice on such a trigger.
- extra damage **only on a thrown / ranged attack** (Dwarven Thrower's "+1d8 on a ranged hit").
- anything gated by a **saving throw** (Ammunition of Slaying's 6d10).
- a bonus that applies **only in a narrow situation** — e.g. Arrow-Catching Shield's "+2 AC
  against ranged attacks" (situational → `applies_to: "shield"` only), Salubrious Armor's "+1 AC
  until end of next turn after you heal".

A weapon's **activatable standard mode** that then applies on every hit is NOT conditional — keep
it (Flame Tongue's flames → `extra_damage` 2d6 Fire).

Rules:

- **applies_to** — from the italic line's leading category + parenthetical: `Weapon`→`weapon`
  (or `ammunition` if the category is Ammunition), `Armor`→`armor`, and a shield item
  (the `(Shield)` / "Shield, +N" pages) → `shield`.
- **"+X bonus to attack rolls and damage rolls"** (a fixed number on a *named* item, e.g.
  Dragon Slayer's +1) → set **both** `attack_bonus` and `damage_bonus` to X.
- **"+X bonus to Armor Class"** (a fixed number, e.g. Demon Armor +1) → `ac_bonus: X`.
- **Generic `+1, +2, or +3` items** (`Weapon/Ammunition/Armor/Shield, +1, +2, or +3`, whose
  rarity line is the compound "Uncommon (+1), Rare (+2), …" → `rarity` is `Varies`): set
  `scales_with_rarity: true` and do **not** set the flat `*_bonus` fields. (The bonus is the
  chosen +N — attack & damage for weapons/ammunition, AC for armor/shields.)
- **extra_damage** — "deals an extra NdM <Type> damage" → `[{ dice: "NdM", damage_type: <ref> }]`.
  When the text says the extra damage is **the same type as the weapon's** (Vicious Weapon),
  **omit** `damage_type`. Multiple extra-damage clauses → multiple array entries.
- A single item may combine fields (e.g. a +1 weapon that also deals extra damage).

Damage-type refs (`/api/2024/damage-types/<index>`): `acid, bludgeoning, cold, fire, force,
lightning, necrotic, piercing, poison, psychic, radiant, slashing, thunder`.

Worked combat examples:

- Flame Tongue (`_Weapon (Any Melee Weapon), Rare (Requires Attunement)_`, "extra 2d6 Fire
  damage on a hit") → `"combat": { "applies_to": "weapon", "extra_damage": [{ "dice": "2d6",
  "damage_type": { "index": "fire", "name": "Fire", "url": "/api/2024/damage-types/fire" } }] }`
- Vicious Weapon ("extra 2d6 damage … same type as the weapon's normal damage") →
  `"combat": { "applies_to": "weapon", "extra_damage": [{ "dice": "2d6" }] }`
- Weapon, +1, +2 or +3 → `"combat": { "applies_to": "weapon", "scales_with_rarity": true }`
- Armor, +1, +2, or +3 → `"combat": { "applies_to": "armor", "scales_with_rarity": true }`
- Demon Armor (+1 AC; the unarmed-strike bonus stays in `desc`) →
  `"combat": { "applies_to": "armor", "ac_bonus": 1 }`
- Dragon Slayer ("+1 to attack and damage" + "extra 3d6 if the target is a Dragon") → keep only
  the flat bonus; the vs-Dragon damage is conditional → `desc`:
  `"combat": { "applies_to": "weapon", "attack_bonus": 1, "damage_bonus": 1 }`
- Arrow-Catching Shield ("+2 AC against ranged attacks") → situational, no flat AC bonus →
  `"combat": { "applies_to": "shield" }`

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
| Scroll                               | `scrolls`        | Scrolls        |
| Wondrous Item / Rod / other          | `wondrous-items` | Wondrous Items |

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
