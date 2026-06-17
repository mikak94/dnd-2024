# Equipment extraction spec (2024)

Convert the D&D 2024 **base/mundane equipment** TABLE pages — scraped from
dnd2024.wikidot.com as Markdown in `data/md/equipment/<page>.md` — into one structured
JSON record **per table row**, written to `data/out/equipment/<item-slug>.json`. Extract
only what the tables state; never invent values.

Unlike spells (one page → one record), here each page is a set of tables and **every data
row is its own item**. Magic items are a separate pass (`magic-item-extraction.md`).

Schema: `src/pipeline/schemas/equipment-2024.ts`. Validate after with `npm run validate equipment`.

## How a subagent runs a batch

Each subagent is given one or more page names from `{weapon, armor, adventuring-gear, tool,
mounts-and-vehicles}`. For every page, **using Claude Sonnet**:

1. Read `data/md/equipment/<page>.md`.
2. For each data row in each _item_ table (skip the property/mastery/ammunition-definition and
   rules prose), produce the JSON object per the rules below.
3. Write it to `data/out/equipment/<item-slug>.json` (pretty-printed, trailing newline).
4. Skip a row if its output file already exists (resumable).

Output **only** the JSON object per item — no prose, no Markdown fences in the file.

## Naming & slug rules (important — fixes wiki "sort-order" inversions)

- **name** — the item's table name, but **un-invert "Sort, Order" names into natural order**:
  `Lantern, Hooded` → `Hooded Lantern`; `Bottle, Glass` → `Glass Bottle`; `Pot, Iron` →
  `Iron Pot`; `Ram, Portable` → `Portable Ram`; `Spikes, Iron` → `Iron Spikes`;
  `Clothes, Fine` → `Fine Clothes`; `Clothes, Traveler's` → `Traveler's Clothes`;
  `Case, Map or Scroll` → `Map or Scroll Case`; `Case, Crossbow Bolt` → `Crossbow Bolt Case`.
  A name with no comma is used as-is.
- **index** — kebab-case of the natural-order name: lowercase, spaces → hyphens, drop
  apostrophes and other punctuation. `Hooded Lantern` → `hooded-lantern`; `Smith's Tools` →
  `smiths-tools`; `Potion of Healing` → `potion-of-healing`; `War Pick` → `war-pick`.
- **url** — `/api/2024/equipment/<index>`.

## Cost & weight parsing

- **cost** — `"<n> <UNIT>"` → `{ "quantity": <n>, "unit": "<unit-lowercased>" }`. Strip commas:
  `1,500 GP` → `{ "quantity": 1500, "unit": "gp" }`. Units: `CP→cp, SP→sp, EP→ep, GP→gp, PP→pp`.
  If cost is `Varies`, `—`, `-`, or blank, **omit** `cost`.
- **weight** — pounds as a number. `2 lb.` → `2`; `1/4 lb.` → `0.25`; `1 1/2 lb.` → `1.5`;
  `1/2 lb.` → `0.5`; `5 lb. (full)` → `5`. If weight is `—`, `-`, blank, or `Varies`, **omit** `weight`.

## Per-page rules

### `weapon.md`

Item tables: **Simple Melee Weapons, Simple Ranged Weapons, Martial Melee Weapons, Martial
Ranged Weapons** (cols: Name, Damage, Properties, Mastery, Weight, Cost) and the **Ammunition**
table (cols: Type, Amount, Storage, Weight, Cost). **Skip** the "Weapon Properties", "Mastery
Properties", and "Improvised Weapons" sections — those are definitions/rules, not items.

For each weapon row:

- **damage** — `"NdM <Type>"` → `{ "damage_dice": "NdM", "damage_type": <damage-type ref> }`.
  Blowgun's `1 Piercing` → `{ "damage_dice": "1", "damage_type": <piercing> }`.
- **properties** — split the Properties cell on commas into `weapon-properties` refs (table below).
  `—` / `-` → omit `properties`. The parenthetical on a property is **not** a separate property:
  - `Versatile (1d10)` → property `versatile` **and** `two_handed_damage: { damage_dice:"1d10",
damage_type: <same type as base damage> }`.
  - `Thrown (Range 20/60)` → property `thrown` **and** `throw_range: { normal:20, long:60 }`.
  - `Ammunition (Range 80/320; Bolt)` → property `ammunition` **and** `range: { normal:80, long:320 }`
    (ignore the `; Bolt/Arrow/Bullet/Needle` ammo-type note).
  - `Two-Handed (unless mounted)` → property `two-handed` (drop the parenthetical note).
- **mastery** — the Mastery cell → one `weapon-mastery-properties` ref (table below).
- **range** — melee weapons have no range cell; do not invent one. Only set `range` from an
  `Ammunition (Range x/y)` property.
- **equipment_categories** — by table, most-specific first:
  - Simple Melee → `simple-melee-weapons, simple-weapons, melee-weapons, weapons`
  - Simple Ranged → `simple-ranged-weapons, simple-weapons, ranged-weapons, weapons`
  - Martial Melee → `martial-melee-weapons, martial-weapons, melee-weapons, weapons`
  - Martial Ranged → `martial-ranged-weapons, martial-weapons, ranged-weapons, weapons`

For each **Ammunition** row (Arrows, Bolts, Bullets-Firearm, Bullets-Sling, Needles): name as
shown (`Bullets, Firearm` → `Firearm Bullets`? **No** — ammunition names are already natural;
keep `Arrows`, `Bolts`; for `Bullets, Firearm`/`Bullets, Sling` use `Firearm Bullets`/`Sling
Bullets`), `equipment_categories: [ammunition]`, set `cost`/`weight`, put the Amount+Storage into
`description` (e.g. `"20 Arrows; stored in a Quiver."`). Also emit singular `arrow` and `bolt`
records (used by class/background refs) as `equipment_categories: [ammunition]` with no cost.

### `armor.md`

Item tables: **Light Armor, Medium Armor, Heavy Armor, Shield** (cols: Armor, Armor Class (AC),
Strength, Stealth, Weight, Cost). Skip the "Armor Training" / "One at a Time" / variant prose.

- **armor_class** — parse the AC cell:
  - `11 + Dex modifier` → `{ "base": 11, "dex_bonus": true }`
  - `12 + Dex modifier (max 2)` → `{ "base": 12, "dex_bonus": true, "max_bonus": 2 }`
  - `14` (flat) → `{ "base": 14, "dex_bonus": false }`
  - Shield `+2` → `{ "base": 2, "dex_bonus": false }`
- **str_minimum** — `Str 13` → `13`; `—`/`-` → omit.
- **stealth_disadvantage** — `Disadvantage` → `true`; `—`/`-` → `false`.
- **equipment_categories** — Light → `light-armor, armor`; Medium → `medium-armor, armor`;
  Heavy → `heavy-armor, armor`; Shield → `shields, armor`.

### `adventuring-gear.md`

One big table (cols: Item, Weight, Cost, Function). Each row is an item.

- **description** — the Function cell, Markdown emphasis stripped, ASCII-normalized.
- **equipment_categories** — default `[adventuring-gear]`, with these overrides:
  - A `*'s Pack` (Burglar's/Diplomat's/Dungeoneer's/Entertainer's/Explorer's/Priest's/Scholar's
    Pack) → `[equipment-packs, adventuring-gear]`, **plus** parse the Function sentence
    ("contains the following items: …") into `contents` — each entry
    `{ "item": <equipment ref>, "quantity": <n> }` (default quantity 1; "10 Candles" → 10;
    "7 flasks of Oil" → 7 of `oil`; "5 days of Rations" → 5 of `rations`). Use natural-order
    slugs for the referenced items (`hooded-lantern`, `map-or-scroll-case`, …).
  - `Arcane Focus` → `[arcane-foci, adventuring-gear]`; `Druidic Focus` →
    `[druidic-foci, adventuring-gear]`; `Holy Symbol` → `[holy-symbols, adventuring-gear]`.
    These rows say `Varies` for cost/weight → omit both.
  - `Ammunition` (the generic row) → `[ammunition]`, omit cost/weight.
  - `Potion of Healing` → `[potions, adventuring-gear]`; `Spell Scroll (...)` →
    `[adventuring-gear]` (these also exist as magic items — that's fine, different dataset).

### `tool.md`

Item tables: **Artisan Tool, Other Tool, Gaming Set, Musical Instrument** (cols: Name/…, Ability,
Weight, Cost). Skip the "Tool Proficiency" prose and the per-tool Utilize/Craft bullet blocks.

- **ability** — the Ability cell → an `ability-scores` ref (table below).
- **equipment_categories** — Artisan Tool → `[artisans-tools, tools]`; Other Tool →
  `[other-tools, tools]`; Gaming Set → `[gaming-sets, tools]`; Musical Instrument →
  `[musical-instruments, tools]`.
- Do **not** emit `utilize`/`craft` (omit; the markdown blocks aren't reliably row-aligned).

### `mounts-and-vehicles.md`

Item tables: **Mounts and Other Animals** (Item, Carrying Capacity, Cost), **Saddles** (Saddle,
Weight, Cost — name `Exotic`→`Exotic Saddle`, `Military`→`Military Saddle`, `Riding`→`Riding
Saddle`), **Tack, Harness, and Drawn Vehicles** (Item, Weight, Cost), and the two large-vehicle
ship tables (Ship, Speed, Crew, …, Cost). Skip the Barding/Speed/Crew/etc. prose.

- For mounts: omit `weight`; put `Carrying Capacity` into `description` (e.g. `"Carrying
capacity 480 lb."`). `equipment_categories: [mounts-and-other-animals, mounts-and-vehicles]`.
- For saddles / tack / drawn vehicles: set `weight`/`cost`;
  `equipment_categories: [tack-harness-and-drawn-vehicles, mounts-and-vehicles]`.
- For ships: omit `weight`; set `cost`; summarize Speed/Crew/Passengers/Cargo/AC/HP/Damage
  Threshold into `description`; `equipment_categories: [waterborne-vehicles, mounts-and-vehicles]`
  (use `airborne-vehicles` for Airship/Lyrandar/Strider if that category exists; otherwise
  `waterborne-vehicles`). Note: the equipment-categories `mounts-and-other-animals`,
  `tack-harness-and-drawn-vehicles`, and `waterborne-vehicles` are **not** in the validated
  shipped category set; `validate.ts` will warn (not fail) on them — that's expected for this page.

## Category-grant extras (not from a table)

In addition to the table rows, emit three **grouped "choose one kind of" items** that 2024
backgrounds grant by reference (`/api/2024/equipment/<index>`) but the wiki lists only as
individual tools — mirroring the category proficiencies `proficiencies.ts` adds:

| index                | name               | equipment_categories           | cost/weight |
| -------------------- | ------------------ | ------------------------------ | ----------- |
| `artisans-tools`     | Artisan's Tools    | `[artisans-tools, tools]`      | omit        |
| `gaming-set`         | Gaming Set         | `[gaming-sets, tools]`         | omit        |
| `musical-instrument` | Musical Instrument | `[musical-instruments, tools]` | omit        |

## Output shape (weapon example)

```json
{
  "index": "longsword",
  "name": "Longsword",
  "equipment_categories": [
    {
      "index": "martial-melee-weapons",
      "name": "Martial Melee Weapons",
      "url": "/api/2024/equipment-categories/martial-melee-weapons"
    },
    {
      "index": "martial-weapons",
      "name": "Martial Weapons",
      "url": "/api/2024/equipment-categories/martial-weapons"
    },
    {
      "index": "melee-weapons",
      "name": "Melee Weapons",
      "url": "/api/2024/equipment-categories/melee-weapons"
    },
    {
      "index": "weapons",
      "name": "Weapons",
      "url": "/api/2024/equipment-categories/weapons"
    }
  ],
  "cost": { "quantity": 15, "unit": "gp" },
  "weight": 3,
  "damage": {
    "damage_dice": "1d8",
    "damage_type": {
      "index": "slashing",
      "name": "Slashing",
      "url": "/api/2024/damage-types/slashing"
    }
  },
  "two_handed_damage": {
    "damage_dice": "1d10",
    "damage_type": {
      "index": "slashing",
      "name": "Slashing",
      "url": "/api/2024/damage-types/slashing"
    }
  },
  "properties": [
    {
      "index": "versatile",
      "name": "Versatile",
      "url": "/api/2024/weapon-properties/versatile"
    }
  ],
  "mastery": {
    "index": "sap",
    "name": "Sap",
    "url": "/api/2024/weapon-mastery-properties/sap"
  },
  "url": "/api/2024/equipment/longsword"
}
```

## Exact reference tables

### equipment-categories — `{ "index": <idx>, "name": <Name>, "url": "/api/2024/equipment-categories/<idx>" }`

`simple-weapons` (Simple Weapons), `simple-melee-weapons` (Simple Melee Weapons),
`simple-ranged-weapons` (Simple Ranged Weapons), `martial-weapons` (Martial Weapons),
`martial-melee-weapons` (Martial Melee Weapons), `martial-ranged-weapons` (Martial Ranged
Weapons), `melee-weapons` (Melee Weapons), `ranged-weapons` (Ranged Weapons), `weapons`
(Weapons), `ammunition` (Ammunition), `armor` (Armor), `light-armor` (Light Armor),
`medium-armor` (Medium Armor), `heavy-armor` (Heavy Armor), `shields` (Shields),
`adventuring-gear` (Adventuring Gear), `equipment-packs` (Equipment Packs), `tools` (Tools),
`artisans-tools` (Artisan's Tools), `other-tools` (Other Tools), `gaming-sets` (Gaming Sets),
`musical-instruments` (Musical Instruments), `arcane-foci` (Arcane Foci), `druidic-foci`
(Druidic Foci), `holy-symbols` (Holy Symbols), `potions` (Potions).

### damage-types — `{ "index": <idx>, "name": <Name>, "url": "/api/2024/damage-types/<idx>" }`

`bludgeoning` (Bludgeoning), `piercing` (Piercing), `slashing` (Slashing). (Mundane weapons
only deal these three.)

### weapon-properties — `{ "index": <idx>, "name": <Name>, "url": "/api/2024/weapon-properties/<idx>" }`

`ammunition` (Ammunition), `finesse` (Finesse), `heavy` (Heavy), `light` (Light), `loading`
(Loading), `range` (Range), `reach` (Reach), `thrown` (Thrown), `two-handed` (Two-Handed),
`versatile` (Versatile).

### weapon-mastery-properties — `{ "index": <idx>, "name": <Name>, "url": "/api/2024/weapon-mastery-properties/<idx>" }`

`cleave` (Cleave), `graze` (Graze), `nick` (Nick), `push` (Push), `sap` (Sap), `slow` (Slow),
`topple` (Topple), `vex` (Vex).

### ability-scores (for tool `ability`) — `{ "index": <idx>, "name": <NAME>, "url": "/api/2024/ability-scores/<idx>" }`

Strength → `str`/`STR`; Dexterity → `dex`/`DEX`; Constitution → `con`/`CON`; Intelligence →
`int`/`INT`; Wisdom → `wis`/`WIS`; Charisma → `cha`/`CHA`.
