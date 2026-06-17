# Level extraction spec (2024)

Convert D&D 2024 class pages — scraped from dnd2024.wikidot.com as Markdown in
`data/md/class/<class>.md` — into 20 level JSON records per class, written to
`data/out/level/<class>-<level>.json`. Extract only what the text states; never invent values.

Schema: `src/pipeline/schemas/level-2024.ts`. Validate after with `npm run validate level`.

## How a subagent runs a batch

Each subagent is given a list of class names. For every class, **using Claude Sonnet**

1. Read `data/md/class/<class>.md`.
2. Find the level progression table.
3. For each level 1-20, produce a JSON object per the rules below.
4. Write each to `data/out/level/<class>-<level>.json` (pretty-printed, trailing newline).
5. Skip if the output file already exists (resumable).

Output **only** the JSON object per level — no prose, no Markdown fences in the file.

## Input layout

Class pages contain a level progression table like:

```
| Level | Prof. Bonus | Features | Rages | Rage Damage |
|-------|-------------|----------|-------|-------------|
| 1     | +2          | Rage, Unarmored Defense | 2 | +2 |
| 2     | +2          | Danger Sense, Reckless Attack | 2 | +2 |
| 3     | +2          | Primal Path, Primal Knowledge | 3 | +2 |
...
```

For spellcasters, there may be spellcasting columns:

```
| Level | Prof. Bonus | Features | Cantrips Known | 1st | 2nd | 3rd | ... |
```

## Output shape

```jsonc
{
  "index": "barbarian-1",
  "level": 1,
  "ability_score_bonuses": 0,
  "prof_bonus": 2,
  "features": [
    { "index": "rage", "name": "Rage", "url": "/api/2024/features/rage" },
    {
      "index": "unarmored-defense-barbarian",
      "name": "Unarmored Defense",
      "url": "/api/2024/features/unarmored-defense-barbarian",
    },
  ],
  "class": {
    "index": "barbarian",
    "name": "Barbarian",
    "url": "/api/2024/classes/barbarian",
  },
  "class_specific": {
    // omit for classes without progression values
    "rage_count": 2,
    "rage_damage_bonus": 2,
    "brutal_critical_dice": 0,
  },
  "spellcasting": {
    // omit for non-spellcasters
    "cantrips_known": 3,
    "spells_known": 4,
    "spell_slots_level_1": 2,
  },
  "url": "/api/2024/classes/barbarian/levels/1",
}
```

## Field rules

- **index** — `<class>-<level>`, e.g. `barbarian-1`.
- **level** — the level number (1-20).
- **ability_score_bonuses** — cumulative ASIs gained by this level. ASIs are typically at levels 4, 8, 12, 16, 19 (5 total by level 20). Count them from the Features column.
- **prof_bonus** — parse from the "Prof. Bonus" column (strip the "+").
- **features** — references to features gained at this level. Parse from the Features column, create kebab-case indexes. Append class name for generic features (e.g., "Unarmored Defense" → `unarmored-defense-barbarian`).
- **class** — the class object for this level.
- **class_specific** — for classes with progression values (see table below). Omit for classes without unique progression columns.
- **spellcasting** — for spellcasting classes. The class page usually has **two tables** (a
  "Class Features" table and a separate spellcasting table); **join them by level**. Parse the
  spellcasting columns:
  - **cantrips_known** — from the "Cantrips" / "Cantrips Known" column (omit if the class has no
    cantrips column, e.g. Paladin, Ranger).
  - **spells_known** — from the **"Prepared Spells"** column. In 2024 every caster _prepares_
    spells (the old known-vs-prepared split is gone), so this column is labelled "Prepared Spells"
    for **all eight casters** — bard, cleric, druid, paladin, ranger, sorcerer, warlock, wizard.
    Emit `spells_known` with that number for each level; omit it only if the cell is blank/`\-`.
  - **spell_slots_level_N** — from the per-spell-level slot columns (1st, 2nd, etc.).
  - **Warlock** uses a pact-magic table shaped `Cantrips | Prepared Spells | Spell Slots | Slot
Level` — there are no per-level slot columns. Still read `spells_known` straight from its
    "Prepared Spells" column.
- **url** — `/api/2024/classes/<class>/levels/<level>`.

## class_specific by class

| Class     | Fields                                                   |
| --------- | -------------------------------------------------------- |
| barbarian | rage_count, rage_damage_bonus, brutal_critical_dice      |
| monk      | ki_points, unarmored_movement, martial_arts (DiceSchema) |
| rogue     | sneak_attack (DiceSchema)                                |
| fighter   | extra_attacks, action_surges, indomitable_uses           |
| sorcerer  | sorcery_points, metamagic_known                          |
| warlock   | invocations*known, mystic_arcanum_level*\* (6,7,8,9)     |
| wizard    | arcane_recovery_levels                                   |

Classes without class_specific: bard, cleric, druid, paladin, ranger

## DiceSchema format

For martial_arts and sneak_attack:

```json
{ "dice_count": 1, "dice_value": 6 } // = 1d6
```

## Exact class references

| Class     | Object                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| barbarian | `{"index":"barbarian","name":"Barbarian","url":"/api/2024/classes/barbarian"}` |
| bard      | `{"index":"bard","name":"Bard","url":"/api/2024/classes/bard"}`                |
| cleric    | `{"index":"cleric","name":"Cleric","url":"/api/2024/classes/cleric"}`          |
| druid     | `{"index":"druid","name":"Druid","url":"/api/2024/classes/druid"}`             |
| fighter   | `{"index":"fighter","name":"Fighter","url":"/api/2024/classes/fighter"}`       |
| monk      | `{"index":"monk","name":"Monk","url":"/api/2024/classes/monk"}`                |
| paladin   | `{"index":"paladin","name":"Paladin","url":"/api/2024/classes/paladin"}`       |
| ranger    | `{"index":"ranger","name":"Ranger","url":"/api/2024/classes/ranger"}`          |
| rogue     | `{"index":"rogue","name":"Rogue","url":"/api/2024/classes/rogue"}`             |
| sorcerer  | `{"index":"sorcerer","name":"Sorcerer","url":"/api/2024/classes/sorcerer"}`    |
| warlock   | `{"index":"warlock","name":"Warlock","url":"/api/2024/classes/warlock"}`       |
| wizard    | `{"index":"wizard","name":"Wizard","url":"/api/2024/classes/wizard"}`          |

## Worked example

Input table row from `data/md/class/barbarian.md`:

```
| 3 | +2 | Primal Path, Primal Knowledge | 3 | +2 |
```

Output (`data/out/level/barbarian-3.json`):

```json
{
  "index": "barbarian-3",
  "level": 3,
  "ability_score_bonuses": 0,
  "prof_bonus": 2,
  "features": [
    {
      "index": "primal-path",
      "name": "Primal Path",
      "url": "/api/2024/features/primal-path"
    },
    {
      "index": "primal-knowledge",
      "name": "Primal Knowledge",
      "url": "/api/2024/features/primal-knowledge"
    }
  ],
  "class": {
    "index": "barbarian",
    "name": "Barbarian",
    "url": "/api/2024/classes/barbarian"
  },
  "class_specific": {
    "rage_count": 3,
    "rage_damage_bonus": 2,
    "brutal_critical_dice": 0
  },
  "url": "/api/2024/classes/barbarian/levels/3"
}
```

## Spellcasting example (full caster — cantrips + prepared spells)

Input table row from `data/md/class/wizard.md` (header
`Level | Proficiency Bonus | Features | Cantrips | Prepared Spells | 1st | 2nd | ...`):

```
| 3 | +2 | Wizard Subclass | 3 | 6 | 4 | 2 | - | - | ... |
```

Output (`data/out/level/wizard-3.json`) — `spells_known` is the **Prepared Spells** value (6):

```json
{
  "index": "wizard-3",
  "level": 3,
  "ability_score_bonuses": 0,
  "prof_bonus": 2,
  "features": [],
  "class": {
    "index": "wizard",
    "name": "Wizard",
    "url": "/api/2024/classes/wizard"
  },
  "class_specific": {
    "arcane_recovery_levels": 2
  },
  "spellcasting": {
    "cantrips_known": 3,
    "spells_known": 6,
    "spell_slots_level_1": 4,
    "spell_slots_level_2": 2
  },
  "url": "/api/2024/classes/wizard/levels/3"
}
```

## Spellcasting example (half caster — prepared spells, no cantrips)

Input spellcasting-table row from `data/md/class/ranger.md` (header
`Level | Favored Enemy | Prepared Spells | 1st | 2nd | 3rd | 4th | 5th`):

```
| 3 | 2 | 4 | 3 | - | - | - | - |
```

Output (`data/out/level/ranger-3.json`) — Ranger has no Cantrips column, so omit
`cantrips_known`; `spells_known` is the **Prepared Spells** value (4):

```json
{
  "index": "ranger-3",
  "level": 3,
  "ability_score_bonuses": 0,
  "prof_bonus": 2,
  "features": [
    {
      "index": "ranger-subclass",
      "name": "Ranger Subclass",
      "url": "/api/2024/features/ranger-subclass"
    }
  ],
  "class": {
    "index": "ranger",
    "name": "Ranger",
    "url": "/api/2024/classes/ranger"
  },
  "spellcasting": {
    "spells_known": 4,
    "spell_slots_level_1": 3
  },
  "url": "/api/2024/classes/ranger/levels/3"
}
```
