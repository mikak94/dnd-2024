# Spell extraction spec (2024)

Convert D&D 2024 spell pages — scraped from dnd2024.wikidot.com as Markdown in
`data/md/spell/<slug>.md` — into one structured JSON record each, written to
`data/out/spell/<slug>.json`. Extract only what the text states; never invent values.

Schema: `src/pipeline/schemas/spell-2024.ts`. Validate after with `npm run validate`.

## How a subagent runs a batch

Each subagent is given a list of slugs. For every slug, **using Claude Sonnet**

1. Read `data/md/spell/<slug>.md`.
2. Produce the JSON object per the rules below.
3. Write it to `data/out/spell/<slug>.json` (pretty-printed, trailing newline).
4. Skip if the output file already exists (resumable).

Output **only** the JSON object per spell — no prose, no Markdown fences in the file.

## Input layout

The Markdown looks like:

```
# <Spell Name>

Source: Player's Handbook

_Level N School (Class, Class, ...)_           ← leveled spell
_School Cantrip (Class, ...)_                  ← cantrip

**Casting Time:** ...
**Range:** ...
**Components:** ...
**Duration:** ...

<body paragraphs>

**Using a Higher-Level Spell Slot.** ...       ← leveled (optional)
**Cantrip Upgrade.** ...                        ← cantrip (optional)
```

## Output shape

```jsonc
{
  "index": "fireball",
  "name": "Fireball",
  "level": 3,
  "school": {
    "index": "evocation",
    "name": "Evocation",
    "url": "/api/2024/magic-schools/evocation",
  },
  "casting_time": "Action",
  "range": "150 feet",
  "components": ["V", "S", "M"],
  "material": "a ball of bat guano and sulfur", // omit field entirely if no M / no parenthetical
  "ritual": false,
  "concentration": false,
  "duration": "Instantaneous",
  "desc": ["..."],
  "higher_level": ["..."], // omit field entirely if absent
  "attack_type": "ranged", // "ranged" | "melee"; omit unless the spell makes a spell attack
  "damage": {
    // omit field entirely if the spell deals no dice-based damage
    "damage_type": {
      "index": "fire",
      "name": "Fire",
      "url": "/api/2024/damage-types/fire",
    },
    "damage_at_slot_level": { "3": "8d6", "4": "9d6" }, // leveled spells: keyed by slot level
    // "damage_at_character_level": { "1": "1d10", "5": "2d10" }, // cantrips: keyed by character level
  },
  "dc": {
    // omit field entirely unless the spell forces a saving throw
    "dc_type": {
      "index": "dex",
      "name": "DEX",
      "url": "/api/2024/ability-scores/dex",
    },
    "dc_success": "half", // "none" | "half" | "other"
  },
  "area_of_effect": { "type": "sphere", "size": 20 }, // omit unless an explicit geometric area
  "heal_at_slot_level": { "1": "2d8", "2": "3d8" }, // omit unless the spell restores Hit Points by dice
  "classes": [
    {
      "index": "sorcerer",
      "name": "Sorcerer",
      "url": "/api/2024/classes/sorcerer",
    },
  ],
  // "subclasses": [...]  // NEVER emit — the wiki carries no subclass associations
  "url": "/api/2024/spells/fireball",
}
```

## Field rules

- **name** — the H1 text, verbatim.
- **index** — the **source file's slug**, i.e. the `<slug>` in `data/md/spell/<slug>.md`. This is the wiki's own slug; copy it verbatim and do **not** re-derive it from the name. The wiki renders an apostrophe as `-s-`, so possessive names keep that hyphen: `data/md/spell/tasha-s-hideous-laughter.md` → `tasha-s-hideous-laughter` (note `-s-`, **not** `tashas-`). Re-slugifying the name instead would mint a second index for the same spell and ship a duplicate.
- **url** — `/api/2024/spells/<index>`.
- **level** — number after "Level"; `0` for any "Cantrip".
- **school** — the school word on the italic line, mapped to the exact object in the table below.
- **classes** — the parenthesised class list on the italic line, **in order**, each mapped to the exact object below.
- **casting_time** — the Casting Time value, but strip an "or Ritual" suffix (e.g. "1 Minute or Ritual" → `1 Minute`).
- **ritual** — `true` if "Ritual" appears in the Casting Time, else `false`.
- **range** — the Range value verbatim.
- **components** — the letters from the Components line, as an array subset of `["V","S","M"]` in that order.
- **material** — the parenthesised text after "M" in the Components line (e.g. "M (a bell and silver wire)" → `a bell and silver wire`). Omit the field entirely when there is no M or no parenthetical.
- **duration** — the Duration value verbatim.
- **concentration** — `true` if the Duration contains "Concentration", else `false`.
- **desc** — body paragraphs as an array of plain-text strings (one per paragraph), **excluding** the higher-level/cantrip-upgrade paragraph. Strip Markdown emphasis markers (`**`, `_`) but keep the leading bold label inline, e.g. `**Audible Alarm.** The alarm…` → `Audible Alarm. The alarm…`. Normalise curly quotes/apostrophes to plain ASCII.
- **higher_level** — the "Using a Higher-Level Spell Slot." or "Cantrip Upgrade." paragraph as a single-element array (Markdown stripped, label kept). Omit the field entirely if absent.
- **damage** — present **only** when the spell deals dice-based damage (a `NdM` roll in the text, e.g. "8d6 Fire damage"). Omit the field entirely otherwise (including healing-only spells and spells that deal a flat/non-dice amount). It has up to three members, all optional:
  - **damage_type** — the damage word stated next to the dice ("8d6 **Fire** damage"), mapped to the exact object in the damage-type table below. If the spell rolls dice but names no type (rare), omit `damage_type`. If a spell lists multiple damage types, use the type of the **primary/base** damage roll.
  - **damage_at_slot_level** — for **leveled** spells (level ≥ 1). A record keyed by slot level (as a string), value = the dice rolled at that level. Start at the spell's own level with its base dice, then apply the "Using a Higher-Level Spell Slot." prose for every slot level up through 9. Example: base "8d6" at level 3, "+1d6 for each slot level above 3" → `{"3":"8d6","4":"9d6","5":"10d6","6":"11d6","7":"12d6","8":"13d6","9":"14d6"}`. If the spell's damage does **not** scale with slot level, include just the single base entry at the spell's level (e.g. `{"1":"3d8"}`).
  - **damage_at_character_level** — for **cantrips** (level 0). A record keyed by character level (as a string). Start at level 1 with the base dice, then apply the "Cantrip Upgrade." prose. Example: base "1d10", upgrades at levels 5/11/17 → `{"1":"1d10","5":"2d10","11":"3d10","17":"4d10"}`. (Cantrips use `damage_at_character_level`, never `damage_at_slot_level`; leveled spells use `damage_at_slot_level`, never `damage_at_character_level`.)
- **attack_type** — `"ranged"` if the text says "ranged spell attack", `"melee"` if "melee spell attack". Omit the field entirely when the spell makes no spell attack roll (e.g. save-based or auto-hit spells). A spell uses _either_ an attack roll _or_ a saving throw for its main effect — rarely both.
- **dc** — present **only** when the spell forces a saving throw ("makes a Dexterity saving throw", "must succeed on a Wisdom saving throw"). Omit otherwise. Members:
  - **dc_type** — the ability named for the save, mapped to the exact ability-score object in the table below.
  - **dc_success** — what happens on a _successful_ save: `"half"` if the target "takes half as much damage"; `"none"` if a successful save avoids the effect entirely (no effect / negates); `"other"` for any partial non-half outcome (e.g. reduced condition, half movement).
  - **desc** — optional; include only if the page gives a distinct sentence describing the save outcome that isn't already obvious from `dc_success`. Usually omit.
- **area_of_effect** — present **only** when the spell states an explicit geometric area. Map the shape word to one of `sphere|cube|cylinder|line|cone`, and `size` = the number of feet for that dimension (radius for sphere/cylinder, edge for cube, length for line, length for cone). E.g. "20-foot-radius Sphere" → `{"type":"sphere","size":20}`; "15-foot Cone" → `{"type":"cone","size":15}`; "60-foot line that is 5 feet wide" → `{"type":"line","size":60}`. Omit the field when the spell targets specific creatures with no geometric area. "Emanation" maps to `sphere`.
- **heal_at_slot_level** — present **only** when the spell restores Hit Points by a dice roll. A record keyed by slot level (string), built like `damage_at_slot_level`: base dice at the spell's level, then the "Using a Higher-Level Spell Slot." prose applied up through 9 (e.g. base "2d8" at level 1, "+2d8 per slot above 1" → `{"1":"2d8","2":"4d8",...,"9":"18d8"}`). Capture only the dice portion; ignore flat "+ your spellcasting ability modifier" additions. Omit the field for non-healing spells.
- **subclasses** — **never emit this field.** The wiki spell pages carry no subclass associations.

## Exact ability-score references (for `dc.dc_type`)

| Ability      | Object                                                              |
| ------------ | ------------------------------------------------------------------- |
| Strength     | `{"index":"str","name":"STR","url":"/api/2024/ability-scores/str"}` |
| Dexterity    | `{"index":"dex","name":"DEX","url":"/api/2024/ability-scores/dex"}` |
| Constitution | `{"index":"con","name":"CON","url":"/api/2024/ability-scores/con"}` |
| Intelligence | `{"index":"int","name":"INT","url":"/api/2024/ability-scores/int"}` |
| Wisdom       | `{"index":"wis","name":"WIS","url":"/api/2024/ability-scores/wis"}` |
| Charisma     | `{"index":"cha","name":"CHA","url":"/api/2024/ability-scores/cha"}` |

## Exact damage-type references

| Type        | Object                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------- |
| Acid        | `{"index":"acid","name":"Acid","url":"/api/2024/damage-types/acid"}`                      |
| Bludgeoning | `{"index":"bludgeoning","name":"Bludgeoning","url":"/api/2024/damage-types/bludgeoning"}` |
| Cold        | `{"index":"cold","name":"Cold","url":"/api/2024/damage-types/cold"}`                      |
| Fire        | `{"index":"fire","name":"Fire","url":"/api/2024/damage-types/fire"}`                      |
| Force       | `{"index":"force","name":"Force","url":"/api/2024/damage-types/force"}`                   |
| Lightning   | `{"index":"lightning","name":"Lightning","url":"/api/2024/damage-types/lightning"}`       |
| Necrotic    | `{"index":"necrotic","name":"Necrotic","url":"/api/2024/damage-types/necrotic"}`          |
| Piercing    | `{"index":"piercing","name":"Piercing","url":"/api/2024/damage-types/piercing"}`          |
| Poison      | `{"index":"poison","name":"Poison","url":"/api/2024/damage-types/poison"}`                |
| Psychic     | `{"index":"psychic","name":"Psychic","url":"/api/2024/damage-types/psychic"}`             |
| Radiant     | `{"index":"radiant","name":"Radiant","url":"/api/2024/damage-types/radiant"}`             |
| Slashing    | `{"index":"slashing","name":"Slashing","url":"/api/2024/damage-types/slashing"}`          |
| Thunder     | `{"index":"thunder","name":"Thunder","url":"/api/2024/damage-types/thunder"}`             |

## Exact school references

| School word   | Object                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------ |
| Abjuration    | `{"index":"abjuration","name":"Abjuration","url":"/api/2024/magic-schools/abjuration"}`          |
| Conjuration   | `{"index":"conjuration","name":"Conjuration","url":"/api/2024/magic-schools/conjuration"}`       |
| Divination    | `{"index":"divination","name":"Divination","url":"/api/2024/magic-schools/divination"}`          |
| Enchantment   | `{"index":"enchantment","name":"Enchantment","url":"/api/2024/magic-schools/enchantment"}`       |
| Evocation     | `{"index":"evocation","name":"Evocation","url":"/api/2024/magic-schools/evocation"}`             |
| Illusion      | `{"index":"illusion","name":"Illusion","url":"/api/2024/magic-schools/illusion"}`                |
| Necromancy    | `{"index":"necromancy","name":"Necromancy","url":"/api/2024/magic-schools/necromancy"}`          |
| Transmutation | `{"index":"transmutation","name":"Transmutation","url":"/api/2024/magic-schools/transmutation"}` |

## Exact class references

| Class     | Object                                                                         |
| --------- | ------------------------------------------------------------------------------ |
| Artificer | `{"index":"artificer","name":"Artificer","url":"/api/2024/classes/artificer"}` |
| Barbarian | `{"index":"barbarian","name":"Barbarian","url":"/api/2024/classes/barbarian"}` |
| Bard      | `{"index":"bard","name":"Bard","url":"/api/2024/classes/bard"}`                |
| Cleric    | `{"index":"cleric","name":"Cleric","url":"/api/2024/classes/cleric"}`          |
| Druid     | `{"index":"druid","name":"Druid","url":"/api/2024/classes/druid"}`             |
| Fighter   | `{"index":"fighter","name":"Fighter","url":"/api/2024/classes/fighter"}`       |
| Monk      | `{"index":"monk","name":"Monk","url":"/api/2024/classes/monk"}`                |
| Paladin   | `{"index":"paladin","name":"Paladin","url":"/api/2024/classes/paladin"}`       |
| Ranger    | `{"index":"ranger","name":"Ranger","url":"/api/2024/classes/ranger"}`          |
| Rogue     | `{"index":"rogue","name":"Rogue","url":"/api/2024/classes/rogue"}`             |
| Sorcerer  | `{"index":"sorcerer","name":"Sorcerer","url":"/api/2024/classes/sorcerer"}`    |
| Warlock   | `{"index":"warlock","name":"Warlock","url":"/api/2024/classes/warlock"}`       |
| Wizard    | `{"index":"wizard","name":"Wizard","url":"/api/2024/classes/wizard"}`          |

> Note: Artificer appears on wiki spell lists but is not a PHB class. Extract it
> faithfully when listed (per-item files keep it); `validate.ts` strips it from the
> class list during assembly, so the aggregated `5e-SRD-Spells.json` stays PHB-only
> (a spell whose only class is Artificer is dropped from the assembled output).

## Worked example

Input (`data/md/spell/fireball.md`):

```
# Fireball

Source: Player's Handbook

_Level 3 Evocation (Sorcerer, Wizard)_

**Casting Time:** Action
**Range:** 150 feet
**Components:** V, S, M (a ball of bat guano and sulfur)
**Duration:** Instantaneous

A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one.

Flammable objects in the area that aren't being worn or carried start burning.

**Using a Higher-Level Spell Slot.** The damage increases by 1d6 for each spell slot level above 3.
```

Output (`data/out/spell/fireball.json`):

```json
{
  "index": "fireball",
  "name": "Fireball",
  "level": 3,
  "school": {
    "index": "evocation",
    "name": "Evocation",
    "url": "/api/2024/magic-schools/evocation"
  },
  "casting_time": "Action",
  "range": "150 feet",
  "components": ["V", "S", "M"],
  "material": "a ball of bat guano and sulfur",
  "ritual": false,
  "concentration": false,
  "duration": "Instantaneous",
  "desc": [
    "A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion. Each creature in a 20-foot-radius Sphere centered on that point makes a Dexterity saving throw, taking 8d6 Fire damage on a failed save or half as much damage on a successful one.",
    "Flammable objects in the area that aren't being worn or carried start burning."
  ],
  "higher_level": [
    "Using a Higher-Level Spell Slot. The damage increases by 1d6 for each spell slot level above 3."
  ],
  "damage": {
    "damage_type": {
      "index": "fire",
      "name": "Fire",
      "url": "/api/2024/damage-types/fire"
    },
    "damage_at_slot_level": {
      "3": "8d6",
      "4": "9d6",
      "5": "10d6",
      "6": "11d6",
      "7": "12d6",
      "8": "13d6",
      "9": "14d6"
    }
  },
  "dc": {
    "dc_type": {
      "index": "dex",
      "name": "DEX",
      "url": "/api/2024/ability-scores/dex"
    },
    "dc_success": "half"
  },
  "area_of_effect": { "type": "sphere", "size": 20 },
  "classes": [
    {
      "index": "sorcerer",
      "name": "Sorcerer",
      "url": "/api/2024/classes/sorcerer"
    },
    { "index": "wizard", "name": "Wizard", "url": "/api/2024/classes/wizard" }
  ],
  "url": "/api/2024/spells/fireball"
}
```

(Fireball makes no spell attack roll, so `attack_type` is omitted; it heals
nothing, so `heal_at_slot_level` is omitted.)

### Cantrip damage example

A cantrip whose desc reads "…the target takes 1d10 Fire damage…" with
`**Cantrip Upgrade.** The damage increases by 1d10 when you reach levels 5
(2d10), 11 (3d10), and 17 (4d10).` produces:

```json
{
  "attack_type": "ranged",
  "damage": {
    "damage_type": {
      "index": "fire",
      "name": "Fire",
      "url": "/api/2024/damage-types/fire"
    },
    "damage_at_character_level": {
      "1": "1d10",
      "5": "2d10",
      "11": "3d10",
      "17": "4d10"
    }
  }
}
```

(Fire Bolt makes a ranged spell attack and forces no save, so `attack_type` is
present and `dc` is omitted — the inverse of Fireball.)
