# Background extraction spec (2024)

Convert D&D 2024 background pages — scraped from dnd2024.wikidot.com as Markdown in
`data/md/background/<slug>.md` — into one structured JSON record each, written to
`data/out/background/<background-index>.json`. Extract only what the text states; never invent values.

Schema: `src/pipeline/schemas/background-2024.ts`. Validate after with `npm run validate background`.

## How a subagent runs a batch

Each subagent is given a list of filenames. For every file, **using Claude Opus**

1. Read `data/md/background/<filename>.md`.
2. Produce the JSON object per the rules below.
3. Write it to `data/out/background/<background-index>.json` (pretty-printed, trailing newline).
4. Skip if the output file already exists (resumable).

Output **only** the JSON object per background — no prose, no Markdown fences in the file.

## Input layout

```
# <Background Name>

Source: Player's Handbook

**Ability Scores:** <A>, <B>, <C>
**Feat:** <Origin Feat>
**Skill Proficiencies:** <Skill>, <Skill>
**Tool Proficiency:** <Tool>
**Equipment:** Choose A or B: (A) <items>, <N> GP; or (B) <M> GP

<Optional flavor paragraphs>
```

## Output shape

```jsonc
{
  "index": "acolyte",
  "name": "Acolyte",
  "starting_proficiencies": [
    {
      "index": "skill-insight",
      "name": "Skill: Insight",
      "url": "/api/2024/proficiencies/skill-insight",
    },
    {
      "index": "skill-religion",
      "name": "Skill: Religion",
      "url": "/api/2024/proficiencies/skill-religion",
    },
    {
      "index": "tool-calligraphers-supplies",
      "name": "Tool: Calligrapher's Supplies",
      "url": "/api/2024/proficiencies/tool-calligraphers-supplies",
    },
  ],
  "ability_scores": [
    { "index": "int", "name": "INT", "url": "/api/2024/ability-scores/int" },
    { "index": "wis", "name": "WIS", "url": "/api/2024/ability-scores/wis" },
    { "index": "cha", "name": "CHA", "url": "/api/2024/ability-scores/cha" },
  ],
  "feat": {
    "index": "magic-initiate",
    "name": "Magic Initiate",
    "url": "/api/2024/feats/magic-initiate",
  },
  "starting_equipment_options": [
    {
      "desc": "Choose A or B: (A) Calligrapher's Supplies, Holy Symbol, ... 8 GP; or (B) 50 GP",
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
                  "index": "calligraphers-supplies",
                  "name": "Calligrapher's Supplies",
                  "url": "/api/2024/equipment/calligraphers-supplies",
                },
              },
              { "option_type": "money", "count": 8, "unit": "GP" },
            ],
          },
          { "option_type": "money", "count": 50, "unit": "GP" },
        ],
      },
    },
  ],
  "url": "/api/2024/backgrounds/acolyte",
}
```

## Field rules

- **name** — the H1 text, verbatim.
- **index** — `slugify(name)`, e.g. "Acolyte" → `acolyte`.
- **starting_proficiencies** — the granted skills and tools, as references whose `index`/`name`
  come from the **canonical proficiencies dataset** (`data/out/5e-SRD-Proficiencies.json`) — look
  each up, do **not** invent a slug. 5e-database naming is type-dependent and inconsistent, so:
  - **Skills:** `skill-<slugify(skill)>`, name `Skill: <Skill>` (e.g. `skill-insight`).
  - **A specific tool / kit / instrument:** use its exact dataset entry — artisan tools, kits and
    instruments are bare (Cartographer's Tools → `cartographers-tools`, Disguise Kit →
    `disguise-kit`, Lute → `lute`), while a handful are `tool-`-prefixed with a `Tool: ` name
    (Thieves' Tools → `tool-thieves-tools`, Calligrapher's Supplies → `tool-calligraphers-supplies`).
  - **A "Choose one kind of X" category line** (Artisan's Tools / Gaming Set / Musical Instrument) →
    the category proficiency: `artisans-tools` / `gaming-set` / `musical-instrument`.
  - url is always `/api/2024/proficiencies/<index>`.
- **ability_scores** — the 3 listed ability options, mapped to the table below, in listed order.
- **feat** — the granted Origin feat: `{ "index": slugify(feat-name), "name": <feat>, "url": "/api/2024/feats/<index>" }`.
- **starting_equipment_options** — model the "Choose A or B" line as ONE Choice (`choose: 1`,
  `type: "equipment"`). `from.option_set_type` is `"options_array"`; each branch is one option:
  - a bundle of items+gold → `{ "option_type": "multiple", "items": [...] }` where each item is a
    `counted_reference` (equipment ref + count) and the gold is a `money` option;
  - a pure-gold branch → `{ "option_type": "money", "count": <N>, "unit": "GP" }`.
    Equipment refs use `/api/2024/equipment/<slugify(item)>`. Omit the field only if the page lists none.
- **desc** — any flavor paragraphs as an array of strings; omit if none.
- **url** — `/api/2024/backgrounds/<index>`.

Note: 2024 backgrounds do NOT grant ideals/bonds/flaws/a feature/languages — there are no such fields.

## slugify

`slugify(s)`: lowercase; replace each run of non-alphanumeric characters with a single `-`;
trim leading/trailing `-`. E.g. "Calligrapher's Supplies" → `calligraphers-supplies`.

## Exact ability-score references

| Ability      | Object                                                              |
| ------------ | ------------------------------------------------------------------- |
| Strength     | `{"index":"str","name":"STR","url":"/api/2024/ability-scores/str"}` |
| Dexterity    | `{"index":"dex","name":"DEX","url":"/api/2024/ability-scores/dex"}` |
| Constitution | `{"index":"con","name":"CON","url":"/api/2024/ability-scores/con"}` |
| Intelligence | `{"index":"int","name":"INT","url":"/api/2024/ability-scores/int"}` |
| Wisdom       | `{"index":"wis","name":"WIS","url":"/api/2024/ability-scores/wis"}` |
| Charisma     | `{"index":"cha","name":"CHA","url":"/api/2024/ability-scores/cha"}` |

## Common tool-proficiency references (look up the rest in `5e-SRD-Proficiencies.json`)

`url` is always `/api/2024/proficiencies/<index>`. Names are verbatim from the dataset.

| Source line                             | index                         | name                          |
| --------------------------------------- | ----------------------------- | ----------------------------- |
| "Choose one kind of Artisan's Tools"    | `artisans-tools`              | Artisan's Tools               |
| "Choose one kind of Gaming Set"         | `gaming-set`                  | Gaming Set                    |
| "Choose one kind of Musical Instrument" | `musical-instrument`          | Musical Instrument            |
| Cartographer's Tools                    | `cartographers-tools`         | Cartographer's Tools          |
| Smith's Tools                           | `smiths-tools`                | Smith's Tools                 |
| Carpenter's Tools                       | `carpenters-tools`            | Carpenter's Tools             |
| Cook's Utensils                         | `cooks-utensils`              | Cook's Utensils               |
| Disguise Kit                            | `disguise-kit`                | Disguise Kit                  |
| Forgery Kit                             | `forgery-kit`                 | Forgery Kit                   |
| Herbalism Kit                           | `herbalism-kit`               | Herbalism Kit                 |
| Thieves' Tools                          | `tool-thieves-tools`          | Tool: Thieves' Tools          |
| Navigator's Tools                       | `tool-navigators-tools`       | Tool: Navigator's Tools       |
| Calligrapher's Supplies                 | `tool-calligraphers-supplies` | Tool: Calligrapher's Supplies |
| Poisoner's Kit                          | `tool-poisoners-kit`          | Tool: Poisoner's Kit          |

## Worked example

Input (`data/md/background/acolyte.md`):

```
# Acolyte

Source: Player's Handbook

**Ability Scores:** Intelligence, Wisdom, Charisma
**Feat:** Magic Initiate (Cleric)
**Skill Proficiencies:** Insight, Religion
**Tool Proficiency:** Calligrapher's Supplies
**Equipment:** Choose A or B: (A) Calligrapher's Supplies, Book (prayers), Holy Symbol, Parchment (10 sheets), Robe, 8 GP; or (B) 50 GP
```

Output (`data/out/background/acolyte.json`):

```json
{
  "index": "acolyte",
  "name": "Acolyte",
  "starting_proficiencies": [
    {
      "index": "skill-insight",
      "name": "Skill: Insight",
      "url": "/api/2024/proficiencies/skill-insight"
    },
    {
      "index": "skill-religion",
      "name": "Skill: Religion",
      "url": "/api/2024/proficiencies/skill-religion"
    },
    {
      "index": "tool-calligraphers-supplies",
      "name": "Tool: Calligrapher's Supplies",
      "url": "/api/2024/proficiencies/tool-calligraphers-supplies"
    }
  ],
  "ability_scores": [
    { "index": "int", "name": "INT", "url": "/api/2024/ability-scores/int" },
    { "index": "wis", "name": "WIS", "url": "/api/2024/ability-scores/wis" },
    { "index": "cha", "name": "CHA", "url": "/api/2024/ability-scores/cha" }
  ],
  "feat": {
    "index": "magic-initiate",
    "name": "Magic Initiate",
    "url": "/api/2024/feats/magic-initiate"
  },
  "starting_equipment_options": [
    {
      "desc": "Choose A or B: (A) Calligrapher's Supplies, Book (prayers), Holy Symbol, Parchment (10 sheets), Robe, 8 GP; or (B) 50 GP",
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
                  "index": "calligraphers-supplies",
                  "name": "Calligrapher's Supplies",
                  "url": "/api/2024/equipment/calligraphers-supplies"
                }
              },
              {
                "option_type": "counted_reference",
                "count": 1,
                "of": {
                  "index": "holy-symbol",
                  "name": "Holy Symbol",
                  "url": "/api/2024/equipment/holy-symbol"
                }
              },
              { "option_type": "money", "count": 8, "unit": "GP" }
            ]
          },
          { "option_type": "money", "count": 50, "unit": "GP" }
        ]
      }
    }
  ],
  "url": "/api/2024/backgrounds/acolyte"
}
```
