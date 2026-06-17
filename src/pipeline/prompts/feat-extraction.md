# Feat extraction spec (2024)

Convert D&D 2024 feat pages — scraped from dnd2024.wikidot.com as Markdown in
`data/md/feat/<slug>.md` — into one structured JSON record each, written to
`data/out/feat/<feat-index>.json`. Extract only what the text states; never invent values.

Schema: `src/pipeline/schemas/feat-2024.ts`. Validate after with `npm run validate feat`.

## How a subagent runs a batch

Each subagent is given a list of filenames. For every file, **using Claude Opus**

1. Read `data/md/feat/<filename>.md`.
2. Produce the JSON object per the rules below.
3. Write it to `data/out/feat/<feat-index>.json` (pretty-printed, trailing newline).
4. Skip if the output file already exists (resumable).

Output **only** the JSON object per feat — no prose, no Markdown fences in the file.

## Input layout

```
# <Feat Name>

Source: Player's Handbook

<Feat Type> Feat[ (Prerequisite: <prereq text>)]

<Body paragraphs describing the feat's benefits>
```

## Output shape

```jsonc
{
  "index": "grappler",
  "name": "Grappler",
  "type": "general",
  "prerequisites": [
    { "type": "level", "level": 4 },
    {
      "type": "ability_score",
      "ability_score": {
        "index": "str",
        "name": "STR",
        "url": "/api/2024/ability-scores/str",
      },
      "minimum_score": 13,
    },
  ],
  "desc": ["You have developed the skills needed to grapple..."],
  "url": "/api/2024/feats/grappler",
}
```

## Field rules

- **name** — the H1 text, verbatim.
- **index** — `slugify(name)` (see slugify below), e.g. "Great Weapon Master" → `great-weapon-master`.
- **type** — classify from the feat's category line / rules text:
  - `origin` — Origin feats (granted by backgrounds; gained at level 1, typically no prerequisite).
  - `fighting-style` — Fighting Style feats (the line says "Fighting Style Feat").
  - `epic-boon` — Epic Boon feats (named "Boon of …"; prerequisite Level 19+).
  - `general` — everything else (General feats; usually "Prerequisite: Level 4+").
- **prerequisites** — parse the "Prerequisite:" text into an array (empty `[]` if none). Each gate is one object keyed by `type`:
  - `{ "type": "level", "level": 4 }` — "Level 4+", "19th level".
  - `{ "type": "ability_score", "ability_score": <ref>, "minimum_score": 13 }` — "Strength 13+".
  - `{ "type": "proficiency", "proficiency": <ref> }` — "Proficiency with martial weapons".
  - `{ "type": "feat", "feat": <ref> }` — requires another feat.
  - `{ "type": "spellcasting" }` or `{ "type": "other", "desc": "<text>" }` — "Spellcasting or Pact Magic feature" / anything not structured above (put the raw phrase in `desc`).
- **desc** — body paragraphs as an array of strings. Strip Markdown emphasis; keep bold labels inline. Exclude the Source line and the type/prerequisite line. **Tables** (a d20 effect table, a per-level spell table, a tools table, etc.) are body content — **never drop them**. Flatten each table into ONE `desc` paragraph: its title, then its rows, with each row's columns joined by a spaced hyphen `" - "` and rows separated by `"; "`. Replace Markdown links `[Text](/url)` with just `Text`. Examples:
  - roll table → `"Mythal-Touched Magic: 1-2 - You and each creature within 15 feet…; 3-7 - You and the triggering spell's caster form a telepathic link for 1 hour; … 20 - The triggering spell dissipates with no effect…"`
  - per-level spell table → `"Mark of Detection Spells: 1st level - Detect Evil and Good, Identify; 2nd level - Detect Thoughts, Find Traps; …"`
  - two-column lookup → `"Siberys Dragonmark Spells: Animal Shapes (Handling), Control Weather (Storm), Demiplane (Making), …"` (put the second column in parentheses).
- **ability_bonuses** — fixed ability-score increases the feat ALWAYS grants (the ability is not chooseable), as `[{ "ability_score": <ref>, "bonus": 1 }]`. Use this for "Increase your Charisma by 1" / "Increase your Strength by 1, to a maximum of 30" — a single named ability with no "or" and no "of your choice". A _chooseable_ increase ("Strength or Dexterity", "of your choice") is NOT this — it's a `choices` entry. Omit the field if the feat grants no fixed increase. (A line is exactly one or the other, never both.)
- **choices** — structured player picks the feat offers. See [Option choices](#option-choices-choices). Omit the field entirely if the feat has none.
- **repeatable** — `true` if the feat's text says it's **Repeatable** (e.g. "Repeatable. You can take this feat more than once."). Omit the field otherwise (most feats can be taken only once).
- **url** — `/api/2024/feats/<index>`.

## slugify

`slugify(s)`: lowercase; replace each run of non-alphanumeric characters with a single `-`;
trim leading/trailing `-`. E.g. "Tavern Brawler" → `tavern-brawler`.

## Exact ability-score references

| Ability      | Object                                                              |
| ------------ | ------------------------------------------------------------------- |
| Strength     | `{"index":"str","name":"STR","url":"/api/2024/ability-scores/str"}` |
| Dexterity    | `{"index":"dex","name":"DEX","url":"/api/2024/ability-scores/dex"}` |
| Constitution | `{"index":"con","name":"CON","url":"/api/2024/ability-scores/con"}` |
| Intelligence | `{"index":"int","name":"INT","url":"/api/2024/ability-scores/int"}` |
| Wisdom       | `{"index":"wis","name":"WIS","url":"/api/2024/ability-scores/wis"}` |
| Charisma     | `{"index":"cha","name":"CHA","url":"/api/2024/ability-scores/cha"}` |

## Worked example

Input (`data/md/feat/grappler.md`):

```
# Grappler

Source: Player's Handbook

General Feat (Prerequisite: Level 4+, Strength or Dexterity 13+)

You've developed the skills necessary to hold your own in close-quarters grappling. You gain the following benefits.

**Ability Score Increase.** Increase your Strength or Dexterity by 1, to a maximum of 20.

**Grappling.** When you hit a creature with an Unarmed Strike as part of the Attack action, you can deal damage and grapple the target.
```

Output (`data/out/feat/grappler.json`):

```json
{
  "index": "grappler",
  "name": "Grappler",
  "type": "general",
  "prerequisites": [
    { "type": "level", "level": 4 },
    {
      "type": "ability_score",
      "ability_score": {
        "index": "str",
        "name": "STR",
        "url": "/api/2024/ability-scores/str"
      },
      "minimum_score": 13
    },
    {
      "type": "ability_score",
      "ability_score": {
        "index": "dex",
        "name": "DEX",
        "url": "/api/2024/ability-scores/dex"
      },
      "minimum_score": 13
    }
  ],
  "desc": [
    "You've developed the skills necessary to hold your own in close-quarters grappling. You gain the following benefits.",
    "Ability Score Increase. Increase your Strength or Dexterity by 1, to a maximum of 20.",
    "Grappling. When you hit a creature with an Unarmed Strike as part of the Attack action, you can deal damage and grapple the target."
  ],
  "choices": [
    {
      "desc": "Increase your Strength or Dexterity by 1, to a maximum of 20.",
      "choose": 1,
      "type": "abilities",
      "from": {
        "option_set_type": "options_array",
        "options": [
          {
            "option_type": "reference",
            "item": {
              "index": "str",
              "name": "STR",
              "url": "/api/2024/ability-scores/str"
            }
          },
          {
            "option_type": "reference",
            "item": {
              "index": "dex",
              "name": "DEX",
              "url": "/api/2024/ability-scores/dex"
            }
          }
        ]
      }
    }
  ],
  "url": "/api/2024/feats/grappler"
}
```

Note grappler's `choices` entry: its "Strength or Dexterity" increase is chooseable, so it
gets an `"abilities"` Choice (over just STR and DEX) **in addition to** the prose in `desc`.
Every chooseable Ability Score Increase works this way — see [Option choices](#option-choices-choices).

## Option choices (`choices`)

Many feats let the player **choose** something — an ability score to raise, skills/tools to gain,
a damage type, a spell list. Capture each distinct pick as one entry in the `choices` array
(shared recursive `ChoiceSchema`; see `src/pipeline/schemas/common-2024.ts`) **in addition to**
leaving the prose in `desc`. **Read the prose and decide**: a feat with no real pick (a fixed
benefit) gets **no** `choices` field. A _fixed_ single-ability increase like "Increase your
Constitution by 1" is also not a choice — it goes in the **`ability_bonuses`** field instead (see
Field rules), not `choices`. A feat can have several picks → several Choice entries (e.g. Skill
Expert = ability increase + a skill proficiency + an Expertise = 3 choices).

Each Choice is `{ "desc"?, "choose": N, "type"?, "from": <option_set> }`. Two `from` shapes:

- **`options_array`** — an enumerable list; `options[]` are `{ "option_type": "reference", "item": { index, name, url } }`. Copy refs **verbatim** from the tables below so they resolve.
- **`resource_list`** — a list too large/parameterized to enumerate (e.g. "from the Wizard spell list"); `{ "option_set_type": "resource_list", "resource_list_url": "<url>" }`. Used only for spell picks.

### The patterns

1. **Ability Score Increase** — a `choices` entry ONLY when the ability is chooseable: "an ability
   score of your choice" → choose from all six; "Strength or Dexterity" (or "Intelligence, Wisdom,
   or Charisma") → choose from just those named. `type` `"abilities"`. (A _fixed_ single-ability
   bump like "Increase your Constitution by 1" — one named ability, no "or", no "of your choice" —
   is **not** a choice: put it in the top-level **`ability_bonuses`** field instead, e.g.
   `[{ "ability_score": <con ref>, "bonus": 1 }]`.) The cap is irrelevant to which field it is:
   **Epic Boons** say "to a maximum of 30" (every other feat says 20) — a chooseable boon increase
   is still a `choices` entry, a fixed one (e.g. Boon of Terror's +1 Charisma) is still
   `ability_bonuses`. For Ability Score
   Improvement's "one by 2 **or** two by 1", keep `choose` at the count and note the +2/two-+1
   split in the Choice `desc`. **Every chooseable Ability Score Increase line gets a Choice — do
   not skip it just because the feat's main benefit is elsewhere.**
   Some feats reuse this same `"abilities"` option shape to pick an ability for a purpose **other
   than** an increase — set the `ability_use` field to say which (omit it, ⇒ `increase`, for an
   ordinary Ability Score Increase):
   - `"spellcasting"` — "Intelligence, Wisdom, or Charisma is your spellcasting ability for this
     feat's spells" (Magic Initiate, Mark of Detection, Boon of Siberys). Picks the casting
     ability; it does **not** raise a score.
   - `"hit_points"` — "Temporary Hit Points equal to your Proficiency Bonus plus your Intelligence,
     Wisdom, or Charisma modifier" (Greater Mark of Hospitality). Picks the modifier ability.
2. **Skill / tool proficiency** — "proficiency in N skills or tools of your choice" (Skilled),
   "one skill of your choice" (Skill Expert). `type` `"proficiencies"`, options = the relevant
   skill and/or tool proficiency refs. This plain-proficiency case needs **no `grants`** field
   (absent ⇒ proficiency).
3. **Expertise** — set the `grants` field on the `proficiencies` Choice to mark what the pick
   confers (omit it for the plain case in #2):
   - `"expertise"` — "choose one skill **in which you have proficiency** … you gain Expertise"
     (Skill Expert's 3rd pick, Boon of Skill, Zhentarim Tactics). The pick assumes you're already
     proficient and upgrades it to Expertise.
   - `"proficiency_or_expertise"` — "if you **lack proficiency** … you gain proficiency; if you
     already have proficiency, you gain Expertise" (Keen Mind, Observant). One pick, conditional
     outcome.
     Options are the 18 skill proficiency refs in either case.
4. **Damage type** — Elemental Adept "Acid, Cold, Fire, Lightning, or Thunder" → `type`
   `"damage_types"`, options = those damage-type refs.
5. **Saving-throw ability** — Resilient "choose one ability … saving throw proficiency" → `type`
   `"abilities"`, options = the six ability scores.
6. **Spell picks** — `type` `"spells"`, `from` = `resource_list` (the pool is too large to
   enumerate). **Also add a structured `spell_source`** so a builder can resolve the pool without
   reading prose — the spell list filtered by level, then by `classes` / `schools` /
   `casting_time` / `ritual_only`, with any `also_spells` unioned in:
   - **`level`** — the exact spell level; `0` for a cantrip, `1` for "a level 1 spell". Provide
     this **or** `max_level`, not both.
   - **`max_level`** — the maximum level for "a level N or lower spell" (Boon of Siberys: `8`).
   - **`schools`** — magic-school indexes when the prose filters by school: Fey Touched
     "Divination or Enchantment" → `["divination","enchantment"]`; Shadow Touched
     "Illusion or Necromancy" → `["illusion","necromancy"]`.
   - **`classes`** — class index(es) when drawn from specific class lists: Genie Magic "from the
     Sorcerer spell list" → `["sorcerer"]`.
   - **`from_class_choice: true`** — when the class is itself the player's pick in a sibling
     `classes` Choice on this feat (Magic Initiate: cantrips/spell come "from the chosen spell
     list"). Don't also set `classes`.
   - **`ritual_only: true`** — when only Ritual-tagged spells qualify (Ritual Caster).
   - **`casting_time`** (`"action"` | `"bonus_action"` | `"reaction"`) — when the feat limits the
     pick by casting time: Genie Magic "a level 1 spell … that has a casting time of an action" →
     `"action"`.
   - **`also_spells`** — explicit spell indexes added on top of the filtered list, for a
     feat-specific "or one of these" list the filters can't express. **Boon of Siberys** ("a level
     8 or lower spell from the Sorcerer spell list **or** a spell from the Siberys Dragonmark Spells
     table") → `{ "max_level": 8, "classes": ["sorcerer"], "also_spells": ["animal-shapes",
"control-weather", "demiplane", "heroes-feast", "maze", "mind-blank", "plane-shift",
"project-image", "regenerate", "symbol", "teleport", "true-seeing"] }` (the table's spell
     indexes). Only fall back to omitting `spell_source` if a source genuinely can't be expressed
     even with these fields.

   Model a **spell-list selection** itself (Magic Initiate's "Cleric, Druid, or Wizard") as a
   separate `"classes"` Choice over the class refs (`/api/2024/classes/<class>`). A "spellcasting
   ability (Int, Wis, or Cha)" pick is an `"abilities"` Choice over those three, marked
   `"ability_use": "spellcasting"` (see pattern 1).

   **Keep the Choice `desc` player-facing** — copy the rulebook sentence, with **no** extraction
   commentary about `resource_list_url` or example lists. The `resource_list_url` can point at a
   representative list (e.g. `/api/2024/classes/wizard/spells`) silently; the structured
   `spell_source` is what a builder uses.

### Reference tables (copy `item` refs verbatim)

**Abilities** — `url` = `/api/2024/ability-scores/<index>`: `str` STR, `dex` DEX, `con` CON,
`int` INT, `wis` WIS, `cha` CHA (use the [Exact ability-score references](#exact-ability-score-references) objects above).

**Damage types** (Elemental Adept) — `url` = `/api/2024/damage-types/<index>`: `acid` Acid,
`cold` Cold, `fire` Fire, `lightning` Lightning, `thunder` Thunder.

**Skill proficiencies** — `url` = `/api/2024/proficiencies/<index>`; name = "Skill: <Name>":
`skill-acrobatics`, `skill-animal-handling`, `skill-arcana`, `skill-athletics`, `skill-deception`,
`skill-history`, `skill-insight`, `skill-intimidation`, `skill-investigation`, `skill-medicine`,
`skill-nature`, `skill-perception`, `skill-performance`, `skill-persuasion`, `skill-religion`,
`skill-sleight-of-hand`, `skill-stealth`, `skill-survival`.

**Artisan's Tools** (Crafter's Fast Crafting table) — `url` = `/api/2024/proficiencies/<index>`:
`carpenters-tools`, `leatherworkers-tools`, `masons-tools`, `potters-tools`, `smiths-tools`,
`tinkers-tools`, `weavers-tools`, `woodcarvers-tools`.

**Musical Instruments** (Musician) — `url` = `/api/2024/proficiencies/<index>`: `bagpipes`,
`drum`, `dulcimer`, `flute`, `horn`, `lute`, `lyre`, `pan-flute`, `shawm`, `viol`.

> For "skills **or** tools" (Skilled), the option list is the skills above **plus** all tool
> proficiencies (Artisan's Tools, instruments, gaming sets, kits). Keep the list to the
> proficiency refs that exist in `5e-SRD-Proficiencies.json`; read it if unsure.

### Worked example — Skill Expert (`data/out/feat/skill-expert.json`)

Three picks → three Choices:

```jsonc
"choices": [
  {
    "desc": "Increase one ability score of your choice by 1, to a maximum of 20.",
    "choose": 1,
    "type": "abilities",
    "from": {
      "option_set_type": "options_array",
      "options": [
        { "option_type": "reference", "item": { "index": "str", "name": "STR", "url": "/api/2024/ability-scores/str" } }
        // ... dex, con, int, wis, cha
      ]
    }
  },
  {
    "desc": "You gain proficiency in one skill of your choice.",
    "choose": 1,
    "type": "proficiencies",
    "from": {
      "option_set_type": "options_array",
      "options": [
        { "option_type": "reference", "item": { "index": "skill-acrobatics", "name": "Skill: Acrobatics", "url": "/api/2024/proficiencies/skill-acrobatics" } }
        // ... all 18 skills
      ]
    }
  },
  {
    "desc": "Choose one skill in which you have proficiency but lack Expertise.",
    "choose": 1,
    "type": "proficiencies",
    "grants": "expertise",
    "from": { "option_set_type": "options_array", "options": [ /* the 18 skills */ ] }
  }
]
```

Note the 2nd pick (gain a skill proficiency) carries **no** `grants` field (plain proficiency),
while the 3rd (Expertise) sets `"grants": "expertise"`.

### Worked example — spell picks with `spell_source`

Magic Initiate's spells are drawn "from the chosen spell list", where the list is a sibling
`classes` Choice (Cleric/Druid/Wizard) — so `from_class_choice: true`. The `desc` is the plain
rulebook sentence (no `resource_list_url` commentary):

```jsonc
// magic-initiate — the cantrips pick (the level-1-spell pick is the same with "level": 1)
{
  "desc": "Learn two cantrips of your choice from the chosen spell list.",
  "choose": 2,
  "type": "spells",
  "spell_source": { "level": 0, "from_class_choice": true },
  "from": {
    "option_set_type": "resource_list",
    "resource_list_url": "/api/2024/classes/wizard/spells",
  },
}
```

Fey Touched filters the whole spell list by school instead:

```jsonc
// fey-touched
{
  "desc": "Choose one level 1 spell from the Divination or Enchantment school of magic.",
  "choose": 1,
  "type": "spells",
  "spell_source": { "level": 1, "schools": ["divination", "enchantment"] },
  "from": {
    "option_set_type": "resource_list",
    "resource_list_url": "/api/2024/spells",
  },
}
```

### Worked example — fixed Ability Score Increase (`ability_bonuses`)

A single named ability with no alternative is fixed — it goes in `ability_bonuses`, NOT `choices`.
E.g. Great Weapon Master ("Increase your Strength by 1, to a maximum of 20") or Boon of Terror
("Increase your Charisma score by 1, to a maximum of 30"):

```jsonc
// great-weapon-master  (and likewise boon-of-terror with the cha ref)
"ability_bonuses": [
  { "ability_score": { "index": "str", "name": "STR", "url": "/api/2024/ability-scores/str" }, "bonus": 1 }
]
```

### Worked example — Epic Boons (`data/out/feat/boon-of-*.json`)

Every Epic Boon ("Boon of …", Prerequisite: Level 19+) opens with an **Ability Score Increase**
line (max 30). Route it by whether the ability is chooseable:

- "Increase one ability score of your choice by 1, to a maximum of 30." → `choices` over all six
  abilities (e.g. Boon of Combat Prowess, below).
- "Increase your Intelligence, Wisdom, or Charisma score by 1, to a maximum of 30." → `choices`
  over just the named subset (e.g. Boon of Recovery).
- "Increase your Charisma score by 1, to a maximum of 30." with no alternative → fixed, so
  `ability_bonuses` (e.g. Boon of Terror — see the fixed-increase example above), NOT `choices`.

```jsonc
// boon-of-combat-prowess
"choices": [
  {
    "desc": "Increase one ability score of your choice by 1, to a maximum of 30.",
    "choose": 1,
    "type": "abilities",
    "from": {
      "option_set_type": "options_array",
      "options": [ /* all six ability refs: str, dex, con, int, wis, cha */ ]
    }
  }
]
```
