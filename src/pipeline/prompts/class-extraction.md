# Class extraction spec (2024)

Convert D&D 2024 class pages — scraped from dnd2024.wikidot.com as Markdown in
`data/md/class/<class>.md` — into one structured JSON record each, written to
`data/out/class/<class>.json`. Extract only what the text states; never invent values.

Schema: `src/pipeline/schemas/class-2024.ts`. Validate after with `npm run validate class`.

## Purpose

All 12 PHB classes already exist in 5e-database. This extraction is for:

1. Verifying our extraction matches the existing data
2. Comparing 2024 changes vs 2014 versions
3. Ensuring our pipeline can handle class data for future updates

## How a subagent runs a batch

Each subagent is given a list of class names. For every class, **using Claude Opus**

1. Read `data/md/class/<class>.md`.
2. Produce the JSON object per the rules below.
3. Write it to `data/out/class/<class>.json` (pretty-printed, trailing newline).
4. Skip if the output file already exists (resumable).

Output **only** the JSON object per class — no prose, no Markdown fences in the file.

## Input layout

The Markdown looks like:

```
# <Class Name>

Source: Player's Handbook

<Flavor paragraph>

## Creating a <Class>

### Hit Points
**Hit Dice:** 1d10 per Fighter level
**Hit Points at 1st Level:** 10 + your Constitution modifier
**Hit Points at Higher Levels:** 1d10 (or 6) + your Constitution modifier per Fighter level after 1st

### Proficiencies
**Armor:** All armor, shields
**Weapons:** Simple weapons, martial weapons
**Tools:** None
**Saving Throws:** Strength, Constitution
**Skills:** Choose 2 from Acrobatics, Animal Handling, ...

## Class Features

| Level | Prof. Bonus | Features | ... |
...

## Subclasses

At 3rd level, you choose a Martial Archetype...
```

## Output shape

```jsonc
{
  "index": "fighter",
  "name": "Fighter",
  "hit_die": 10,
  "proficiency_choices": [
    {
      "desc": "Choose 2 from Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, and Survival",
      "choose": 2,
      "type": "proficiencies",
      "from": {
        "option_set_type": "options_array",
        "options": [
          {
            "option_type": "reference",
            "item": {
              "index": "skill-acrobatics",
              "name": "Skill: Acrobatics",
              "url": "/api/2024/proficiencies/skill-acrobatics",
            },
          },
        ],
      },
    },
  ],
  "proficiencies": [
    {
      "index": "all-armor",
      "name": "All armor",
      "url": "/api/2024/proficiencies/all-armor",
    },
    {
      "index": "shields",
      "name": "Shields",
      "url": "/api/2024/proficiencies/shields",
    },
  ],
  "saving_throws": [
    { "index": "str", "name": "STR", "url": "/api/2024/ability-scores/str" },
    { "index": "con", "name": "CON", "url": "/api/2024/ability-scores/con" },
  ],
  "starting_equipment": [
    {
      "equipment": {
        "index": "chain-mail",
        "name": "Chain Mail",
        "url": "/api/2024/equipment/chain-mail",
      },
      "quantity": 1,
    },
  ],
  "starting_equipment_options": [
    {
      "desc": "Choose A or B: (A) Chain Mail, Greatsword, 8 Javelins, Dungeoneer's Pack, and 4 GP; or (B) 155 GP",
      "choose": 1,
      "type": "equipment",
      "from": {
        "option_set_type": "options_array",
        "options": [
          {
            "option_type": "multiple",
            "items": [
              {
                "option_type": "counted_reference",
                "count": 1,
                "of": {
                  "index": "chain-mail",
                  "name": "Chain Mail",
                  "url": "/api/2024/equipment/chain-mail",
                },
              },
              {
                "option_type": "counted_reference",
                "count": 8,
                "of": {
                  "index": "javelin",
                  "name": "Javelin",
                  "url": "/api/2024/equipment/javelin",
                },
              },
              { "option_type": "money", "count": 4, "unit": "GP" },
            ],
          },
          { "option_type": "money", "count": 155, "unit": "GP" },
        ],
      },
    },
  ],
  "class_levels": "/api/2024/classes/fighter/levels",
  "multi_classing": {
    "prerequisites": [
      {
        "ability_score": {
          "index": "str",
          "name": "STR",
          "url": "/api/2024/ability-scores/str",
        },
        "minimum_score": 13,
      },
    ],
    "proficiencies": [
      {
        "index": "light-armor",
        "name": "Light armor",
        "url": "/api/2024/proficiencies/light-armor",
      },
    ],
  },
  "subclasses": [
    {
      "index": "champion",
      "name": "Champion",
      "url": "/api/2024/subclasses/champion",
    },
  ],
  "spellcasting": null, // omit for non-spellcasters; for casters: { "level": <N>, "spellcasting_ability": <ability ref> }
  "url": "/api/2024/classes/fighter",
}
```

## Field rules

- **index** — kebab-case of the name (same as filename).
- **name** — the H1 text, verbatim.
- **hit_die** — the die value from "Hit Dice: 1dN" (just the number N).
- **proficiency_choices** — skill choices from the Proficiencies section. Parse "Choose N from X, Y, Z...".
- **proficiencies** — armor, weapon, and tool proficiencies.
- **saving_throws** — the two ability scores listed under Saving Throws.
- **starting_equipment** — fixed starting equipment items (rare in 2024; usually empty since the whole kit is a choice).
- **starting_equipment_options** — model the "Choose A or B" (or A/B/C) line as ONE Choice
  (`choose: 1`, `type: "equipment"`). `from.option_set_type` is `"options_array"`; each lettered
  branch is one option:
  - a bundle of items + gold → `{ "option_type": "multiple", "items": [...] }` where each item is a
    `counted_reference` (`count` + an equipment `of` ref) and the gold is a `money` option
    (`{ "option_type": "money", "count": <N>, "unit": "GP" }`);
  - a pure-gold branch → a top-level `money` option.
    Equipment refs use `/api/2024/equipment/<slugify(item)>`. Keep a specifier in the ref `name` but
    point the `index` at the canonical item — e.g. "Druidic Focus (Quarterstaff)" → name
    `"Druidic Focus (Quarterstaff)"`, index `druidic-focus`; "Arcane Focus (crystal)" → index
    `arcane-focus`. For a "this OR that" pick inside a bundle (e.g. monk's "Artisan's Tools or Musical
    Instrument"), nest it as `{ "option_type": "choice", "choice": { "desc": "...", "choose": 1,
"type": "equipment", "from": { "option_set_type": "options_array", "options": [ ...counted_reference... ] } } }`.
    **One named exception — the Wizard's "Spellbook".** Across all 12 classes, every starting-equipment
    item is a real catalog item EXCEPT the Wizard's Spellbook, which in 2024 is a class feature, not
    buyable gear (the catalog only has "Locking Spellbook"). Emit the Wizard's Spellbook as a plain
    `{ "option_type": "string", "string": "Spellbook" }`, NOT a `counted_reference` — a `counted_reference`
    `of` index must resolve to a real equipment item (the referential-integrity test enforces this) and
    there is no `spellbook` item to point at. Use `counted_reference` for every other item; this is the
    only exception, so you do not need to consult the equipment dataset while extracting.
    Also keep the human-readable `desc` ("Choose A or B: (A) …; or (B) …"). Omit the field only if the
    class lists no starting equipment.
- **class_levels** — `/api/2024/classes/<index>/levels`.
- **multi_classing** — the ability prerequisite(s) to multiclass into this class and the
  proficiencies you gain when you do. Both derive from the **class page** plus the general
  multiclassing rule (source: `/class:multiclassing` → `data/md/multiclassing/multiclassing.md`):
  you need _"a score of at least 13 in the primary ability of the new class"_ and gain _"some of the
  new class's starting proficiencies, as detailed in each class's description."_
  - **prerequisites / prerequisite_options** — read the class's **Primary Ability** (the Core Traits
    table) and require 13 in it:
    - a single ability (Wizard → Intelligence) → `"prerequisites": [{ "ability_score": <ref>, "minimum_score": 13 }]`.
    - "X **and** Y" (Monk → Dexterity and Wisdom) → two entries in `prerequisites` (both required).
    - "X **or** Y" (Fighter → Strength or Dexterity) → omit `prerequisites` entirely (a flat entry
      would force that one ability and nullify the choice); use
      `"prerequisite_options": { "type": "ability_scores", "choose": 1, "from": { "option_set_type": "options_array", "options": [ { "option_type": "ability_minimum", "ability_score": <X ref>, "minimum_score": 13 }, { "option_type": "ability_minimum", "ability_score": <Y ref>, "minimum_score": 13 } ] } }`.
  - **proficiencies** — the **fixed** armor/weapon/tool/instrument trainings named in the class's
    **"As a Multiclass Character"** section (e.g. Barbarian: "proficiency with Martial weapons, and
    training with Shields" → `martial-weapons`, `shields`). Exclude the Hit Point Die and "level 1
    features" (not proficiencies). Empty array if none are listed (e.g. Wizard, Monk, Sorcerer). Index
    each ref the same way as the class's main `proficiencies` (the `index` must resolve in
    `5e-SRD-Proficiencies.json`). Two gotchas:
    - a **tool** proficiency takes the `tool-`-prefixed index — Thieves' Tools → `tool-thieves-tools`
      (not `thieves-tools`); a musical instrument → `musical-instrument`.
    - **"proficiency in one skill of your choice"** is a _player choice_, not a fixed grant — omit it
      (do not invent a placeholder skill ref). The fixed trainings on the same line (e.g. Light armor,
      the instrument) are still recorded.
- **subclasses** — references to available subclasses. Parse from the Subclasses section.
- **spellcasting** — for caster classes only, an object with exactly two fields: `level` (the class
  level at which the Spellcasting/Pact Magic feature is gained — `1` for all 2024 PHB casters) and
  `spellcasting_ability` (the ability ref named in the feature's "Spellcasting Ability" line). Do NOT
  emit an `info` prose array — it's unused and duplicates the class's "Spellcasting" feature record.
  Omit the whole field for non-casters.
- **url** — `/api/2024/classes/<index>`.

## Exact ability-score references (for saving_throws)

| Ability      | Object                                                              |
| ------------ | ------------------------------------------------------------------- |
| Strength     | `{"index":"str","name":"STR","url":"/api/2024/ability-scores/str"}` |
| Dexterity    | `{"index":"dex","name":"DEX","url":"/api/2024/ability-scores/dex"}` |
| Constitution | `{"index":"con","name":"CON","url":"/api/2024/ability-scores/con"}` |
| Intelligence | `{"index":"int","name":"INT","url":"/api/2024/ability-scores/int"}` |
| Wisdom       | `{"index":"wis","name":"WIS","url":"/api/2024/ability-scores/wis"}` |
| Charisma     | `{"index":"cha","name":"CHA","url":"/api/2024/ability-scores/cha"}` |

## Spellcasting classes

These classes have `spellcasting` (`{ "level": 1, "spellcasting_ability": <ability ref> }`):

- bard (CHA), cleric (WIS), druid (WIS), paladin (CHA), ranger (WIS), sorcerer (CHA), warlock (CHA), wizard (INT)

Non-casters (no `spellcasting`):

- barbarian, fighter, monk, rogue

## Worked example

Input (`data/md/class/barbarian.md`):

```
# Barbarian

Source: Player's Handbook

A fierce warrior of primitive background who can enter a battle rage.

## Creating a Barbarian

### Hit Points
**Hit Dice:** 1d12 per Barbarian level

### Proficiencies
**Armor:** Light armor, medium armor, shields
**Weapons:** Simple weapons, martial weapons
**Tools:** None
**Saving Throws:** Strength, Constitution
**Skills:** Choose 2 from Animal Handling, Athletics, Intimidation, Nature, Perception, and Survival
```

Output (`data/out/class/barbarian.json`):

```json
{
  "index": "barbarian",
  "name": "Barbarian",
  "hit_die": 12,
  "proficiency_choices": [
    {
      "desc": "Choose 2 from Animal Handling, Athletics, Intimidation, Nature, Perception, and Survival",
      "choose": 2,
      "type": "proficiencies",
      "from": {
        "option_set_type": "options_array",
        "options": [
          {
            "option_type": "reference",
            "item": {
              "index": "skill-animal-handling",
              "name": "Skill: Animal Handling",
              "url": "/api/2024/proficiencies/skill-animal-handling"
            }
          },
          {
            "option_type": "reference",
            "item": {
              "index": "skill-athletics",
              "name": "Skill: Athletics",
              "url": "/api/2024/proficiencies/skill-athletics"
            }
          },
          {
            "option_type": "reference",
            "item": {
              "index": "skill-intimidation",
              "name": "Skill: Intimidation",
              "url": "/api/2024/proficiencies/skill-intimidation"
            }
          },
          {
            "option_type": "reference",
            "item": {
              "index": "skill-nature",
              "name": "Skill: Nature",
              "url": "/api/2024/proficiencies/skill-nature"
            }
          },
          {
            "option_type": "reference",
            "item": {
              "index": "skill-perception",
              "name": "Skill: Perception",
              "url": "/api/2024/proficiencies/skill-perception"
            }
          },
          {
            "option_type": "reference",
            "item": {
              "index": "skill-survival",
              "name": "Skill: Survival",
              "url": "/api/2024/proficiencies/skill-survival"
            }
          }
        ]
      }
    }
  ],
  "proficiencies": [
    {
      "index": "light-armor",
      "name": "Light armor",
      "url": "/api/2024/proficiencies/light-armor"
    },
    {
      "index": "medium-armor",
      "name": "Medium armor",
      "url": "/api/2024/proficiencies/medium-armor"
    },
    {
      "index": "shields",
      "name": "Shields",
      "url": "/api/2024/proficiencies/shields"
    },
    {
      "index": "simple-weapons",
      "name": "Simple weapons",
      "url": "/api/2024/proficiencies/simple-weapons"
    },
    {
      "index": "martial-weapons",
      "name": "Martial weapons",
      "url": "/api/2024/proficiencies/martial-weapons"
    }
  ],
  "saving_throws": [
    { "index": "str", "name": "STR", "url": "/api/2024/ability-scores/str" },
    { "index": "con", "name": "CON", "url": "/api/2024/ability-scores/con" }
  ],
  "starting_equipment": [],
  "class_levels": "/api/2024/classes/barbarian/levels",
  "subclasses": [
    {
      "index": "path-of-the-berserker",
      "name": "Path of the Berserker",
      "url": "/api/2024/subclasses/path-of-the-berserker"
    }
  ],
  "url": "/api/2024/classes/barbarian"
}
```
