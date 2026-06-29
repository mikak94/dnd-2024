# Class-feature extraction spec (2024)

Extract the **base-class features** of one class into Feature JSON records, written to
`data/out/feature/<feature-index>.json`. This is the class-level counterpart to
`feature-extraction.md` (which handles _subclass_ features). Extract only what the text
states; never invent values.

Schema: `src/pipeline/schemas/feature-2024.ts`. Validate after with `npm run validate feature`.

## Critical difference from subclass features: indexes are GIVEN, not derived

The class's Level records already reference each base-class feature by an exact
`index` / `name` / `level`. You are handed that **manifest**. You MUST emit one Feature record
per manifest entry, using its **index, name, and level verbatim** — do not re-slug or rename.
This is what makes the Level→feature references resolve. Your only job is to fill in `desc`
(and `feature_specific` / `prerequisites` where applicable) from the class Markdown.

## How a subagent runs a batch

For the class you are given, **using Claude Sonnet**:

1. Read the manifest you were given: a list of `{ index, name, level }` base-class features.
2. Read `data/md/class/<class>.md`. Features appear as `### Level N: <Feature Name>` sections.
3. For each manifest entry, produce a Feature record (rules below): match it to the
   `### Level N: <name>` section (same name/level) and extract that section's prose as `desc`.
4. Write each to `data/out/feature/<index>.json` (pretty-printed, trailing newline), using the
   manifest's exact index. Skip if the file already exists (resumable).

Output **only** the JSON object per feature — no prose, no Markdown fences in the file.

## Field rules

- **index / name / level** — copy **verbatim** from the manifest entry. (Do not derive them.)
- **class** — the given class object (table below). Base-class features have **no `subclass`** field.
- **desc** — the prose under the matching `### Level N: <name>` section, as an array of
  paragraph strings. Strip Markdown emphasis but keep bold labels inline. Stop at the next
  `###` header. If a table's options ARE captured in `feature_specific` (e.g. a Fighting Style
  or metamagic list), summarize it in prose. Otherwise — any table the schema does NOT model
  (a spell-by-level list, a random d6/d12 effect table, a "roll on the table" menu) — **preserve
  it verbatim in `desc`** (keep the Markdown table rows or numbered list); never drop or
  lossy-summarize table data.
- **Subclass-marker entries** — a manifest entry whose name is `"<Class> Subclass"` (e.g. the
  level-3 "Barbarian Subclass") or `"Subclass Feature"` (the later "you gain a subclass
  feature" levels) is a placeholder, not a described feature. Emit it with a short **generic
  desc**, e.g.:
  - `"<Class> Subclass"` → `["You gain a <Class> subclass of your choice. ..."]` (use the
    section text if the page describes choosing a subclass; otherwise this generic line).
  - `"Subclass Feature"` → `["You gain a feature granted by your <Class> subclass."]`
- **prerequisites** — `[]` unless a `**Prerequisite:**` line appears in the section (rare for
  base-class features). Same shapes as `feature-extraction.md`.
- **activation** / **recharge** — follow `feature-extraction.md`'s
  [Activation & recharge](feature-extraction.md#activation--recharge) rules. Most base-class
  features are passive, but active ones (Bardic Inspiration, Flurry of Blows, Channel Divinity,
  Wild Shape, …) carry an explicit action type and often a recharge condition.
- **feature_specific** — include ONLY when the feature presents a choice the schema models.
  Most of the choice-bearing base-class features live here — **Fighting Style**, **Expertise**,
  **Weapon Mastery** — so follow the rules + option tables in `feature-extraction.md`'s
  [Option choices](feature-extraction.md#option-choices-feature_specific) section verbatim (the
  count comes from this class's prose; Weapon Mastery is melee-only when the prose says "Melee").
  Omit otherwise — most base-class features have no choice, and a generic record that states no
  count gets none.
- **feature_specific.spellcasting** — when a base-class feature lets you cast a **named spell**
  (e.g. Ranger's Favored Enemy → Hunter's Mark, Paladin's Faithful Steed → Find Steed), emit it per
  `feature-extraction.md`'s [Spell grants](feature-extraction.md#spell-grants-feature_specificspellcasting)
  section. **Skip** "of your choice" picks (Mystic Arcanum, Spell Mastery) and the
  patron/domain/circle "_X_ Spells" tables (those live on the subclass `spells` list).
- **feature_specific.benefit_options** — for "choose one of the following benefits" features,
  follow `feature-extraction.md`'s [Benefit options](feature-extraction.md#benefit-options-feature_specificbenefit_options)
  rules. Base-class features rarely use this pattern, but apply it when they do.
- **armor_class** — follow `feature-extraction.md`'s [Armor Class](feature-extraction.md#armor-class-armor_class)
  rules. The base-class case is **Unarmored Defense** (Barbarian: 10 + DEX + CON, Shield allowed;
  Monk: 10 + DEX + WIS, no Shield) → a `unarmored_defense` effect. Omit for features that don't change AC.
- **url** — `/api/2024/features/<index>`.

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

Manifest entry: `{ "index": "reckless-attack", "name": "Reckless Attack", "level": 2 }` for class `barbarian`.

Matching section in `data/md/class/barbarian.md`:

```
### Level 2: Reckless Attack

You can throw aside all concern for defense to attack with increased ferocity. When you make your first attack roll on your turn, you can decide to attack recklessly...
```

Output (`data/out/feature/reckless-attack.json`):

```json
{
  "index": "reckless-attack",
  "name": "Reckless Attack",
  "level": 2,
  "class": {
    "index": "barbarian",
    "name": "Barbarian",
    "url": "/api/2024/classes/barbarian"
  },
  "desc": [
    "You can throw aside all concern for defense to attack with increased ferocity. When you make your first attack roll on your turn, you can decide to attack recklessly..."
  ],
  "prerequisites": [],
  "url": "/api/2024/features/reckless-attack"
}
```

Subclass-marker example — manifest `{ "index": "barbarian-subclass-feature-6", "name": "Subclass Feature", "level": 6 }`:

```json
{
  "index": "barbarian-subclass-feature-6",
  "name": "Subclass Feature",
  "level": 6,
  "class": {
    "index": "barbarian",
    "name": "Barbarian",
    "url": "/api/2024/classes/barbarian"
  },
  "desc": ["You gain a feature granted by your Barbarian subclass."],
  "prerequisites": [],
  "url": "/api/2024/features/barbarian-subclass-feature-6"
}
```
