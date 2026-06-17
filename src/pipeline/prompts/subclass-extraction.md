# Subclass extraction spec (2024)

Convert D&D 2024 subclass pages — scraped from dnd2024.wikidot.com as Markdown in
`data/md/subclass/<class>--<slug>.md` — into one structured JSON record each, written to
`data/out/subclass/<subclass-index>.json`. Extract only what the text states; never invent values.

Schema: `src/pipeline/schemas/subclass-2024.ts`. Validate after with `npm run validate subclass`.

## How a subagent runs a batch

Each subagent is given a list of filenames. For every file, **using Claude Opus**

1. Read `data/md/subclass/<filename>.md`.
2. Derive class from filename prefix (before `--`), e.g. `bard--college-of-glamour.md` → class = `bard`.
3. Produce the JSON object per the rules below.
4. Write it to `data/out/subclass/<subclass-index>.json` (pretty-printed, trailing newline).
5. Skip if the output file already exists (resumable).

Output **only** the JSON object per subclass — no prose, no Markdown fences in the file.

**Important:** This extracts subclass metadata only. Features are extracted separately by `feature-extraction.md`.

## Input layout

The Markdown looks like:

```
# <Subclass Name>

Source: Player's Handbook

_<Flavor sentence>_

<Intro paragraphs describing the subclass>

### Level 3: <Feature Name>
<Feature description>

### Level 6: <Feature Name>
<Feature description>

...
```

## Output shape

```jsonc
{
  "index": "college-of-glamour",
  "class": {
    "index": "bard",
    "name": "Bard",
    "url": "/api/2024/classes/bard",
  },
  "name": "College of Glamour",
  "subclass_flavor": "Bard College",
  "desc": [
    "The College of Glamour traces its origins to the beguiling magic...",
  ],
  "subclass_levels": "/api/2024/subclasses/college-of-glamour/levels",
  "spells": [
    // omit entirely if no expanded spell list
    {
      "prerequisites": [{ "index": "college-of-glamour-3", "type": "level" }],
      "spell": {
        "index": "charm-person",
        "name": "Charm Person",
        "url": "/api/2024/spells/charm-person",
      },
    },
  ],
  "url": "/api/2024/subclasses/college-of-glamour",
}
```

## Field rules

- **name** — the H1 text, verbatim.
- **index** — kebab-case of the name (lowercase, spaces→hyphens, drop apostrophes/punctuation), e.g. "College of Glamour" → `college-of-glamour`.
- **class** — derived from filename prefix, mapped to the exact class object in the table below.
- **subclass_flavor** — the category name for this class's subclasses (see table below).
- **desc** — intro paragraphs BEFORE the first `### Level N:` header. This is the subclass's thematic description. Strip Markdown emphasis. Array of strings, one per paragraph.
- **subclass_levels** — always `/api/2024/subclasses/<index>/levels`.
- **spells** — present ONLY if the subclass grants an expanded spell list ("always prepared" spells). Look for phrases like "you always have the following spells prepared" or spell tables. Each entry has:
  - **prerequisites** — `[{ "index": "<subclass>-<level>", "type": "level" }]` based on when spells are gained.
  - **spell** — reference to the spell entity. Its `index`/`url` must be the spell's **source slug** (the `<slug>` of `data/md/spell/<slug>.md`), NOT a slug you re-derive from the spell name. The wiki renders an apostrophe as `-s-`, so e.g. "Tasha's Hideous Laughter" → `tasha-s-hideous-laughter` (note `-s-`, not `tashas-`); using the wrong form leaves a dangling reference to a non-existent spell.
- **url** — `/api/2024/subclasses/<index>`.

## Subclass flavor by class

| Class     | subclass_flavor     |
| --------- | ------------------- |
| barbarian | Primal Path         |
| bard      | Bard College        |
| cleric    | Divine Domain       |
| druid     | Druid Circle        |
| fighter   | Martial Archetype   |
| monk      | Monastic Tradition  |
| paladin   | Sacred Oath         |
| ranger    | Ranger Archetype    |
| rogue     | Roguish Archetype   |
| sorcerer  | Sorcerous Origin    |
| warlock   | Otherworldly Patron |
| wizard    | Arcane Tradition    |

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

Input (`data/md/subclass/bard--college-of-glamour.md`):

```
# College of Glamour

Source: Player's Handbook

_Weave Beguiling Fey Magic_

The College of Glamour traces its origins to the beguiling magic of the Feywild. The bards who study this magic weave threads of beauty and terror into their songs and stories.

### Level 3: Beguiling Magic

You always have the Charm Person and Mirror Image spells prepared. In addition, immediately after you cast an Enchantment spell...

### Level 3: Mantle of Inspiration

As a Bonus Action, you can expend a use of Bardic Inspiration...
```

Output (`data/out/subclass/college-of-glamour.json`):

```json
{
  "index": "college-of-glamour",
  "class": {
    "index": "bard",
    "name": "Bard",
    "url": "/api/2024/classes/bard"
  },
  "name": "College of Glamour",
  "subclass_flavor": "Bard College",
  "desc": [
    "Weave Beguiling Fey Magic",
    "The College of Glamour traces its origins to the beguiling magic of the Feywild. The bards who study this magic weave threads of beauty and terror into their songs and stories."
  ],
  "subclass_levels": "/api/2024/subclasses/college-of-glamour/levels",
  "spells": [
    {
      "prerequisites": [{ "index": "college-of-glamour-3", "type": "level" }],
      "spell": {
        "index": "charm-person",
        "name": "Charm Person",
        "url": "/api/2024/spells/charm-person"
      }
    },
    {
      "prerequisites": [{ "index": "college-of-glamour-3", "type": "level" }],
      "spell": {
        "index": "mirror-image",
        "name": "Mirror Image",
        "url": "/api/2024/spells/mirror-image"
      }
    }
  ],
  "url": "/api/2024/subclasses/college-of-glamour"
}
```
