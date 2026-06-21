# Feature extraction spec (2024)

Convert D&D 2024 subclass pages — scraped from dnd2024.wikidot.com as Markdown in
`data/md/subclass/<class>--<slug>.md` — into multiple feature JSON records, one per feature section,
written to `data/out/feature/<feature-index>.json`. Extract only what the text states; never invent values.

Schema: `src/pipeline/schemas/feature-2024.ts`. Validate after with `npm run validate feature`.

## How a subagent runs a batch

Each subagent is given a list of filenames. For every file, **using Claude Opus**

1. Read `data/md/subclass/<filename>.md`.
2. Derive class from filename prefix (before `--`), subclass slug from filename suffix.
3. Find all `### Level N: <Feature Name>` sections.
4. For each feature section, produce a JSON object per the rules below.
5. Write each to `data/out/feature/<feature-index>.json` (pretty-printed, trailing newline).
6. Skip if the output file already exists (resumable).

Output **only** the JSON object per feature — no prose, no Markdown fences in the file.

## Input layout

Feature sections look like:

```
### Level 3: Beguiling Magic

You always have the Charm Person and Mirror Image spells prepared. In addition, immediately after you cast an Enchantment spell, you can cause a creature you can see within 60 feet of yourself to make a Wisdom saving throw against your spell save DC.

### Level 3: Mantle of Inspiration

As a Bonus Action, you can expend a use of Bardic Inspiration, rolling your Bardic Inspiration die. When you do so, choose a number of willing creatures you can see...

**Prerequisite:** 5th level, Pact of the Blade
```

## Output shape

```jsonc
{
  "index": "college-of-glamour-3-beguiling-magic",
  "name": "Beguiling Magic",
  "level": 3,
  "class": {
    "index": "bard",
    "name": "Bard",
    "url": "/api/2024/classes/bard",
  },
  "subclass": {
    "index": "college-of-glamour",
    "name": "College of Glamour",
    "url": "/api/2024/subclasses/college-of-glamour",
  },
  "parent": null, // omit unless this is an invocation/metamagic option
  "desc": [
    "You always have the Charm Person and Mirror Image spells prepared. In addition...",
  ],
  "prerequisites": [], // empty array if no prerequisites
  "url": "/api/2024/features/college-of-glamour-3-beguiling-magic",
}
```

## Field rules

- **index** — `<subclass-index>-<level>-<feature-name-slug>`, e.g. `college-of-glamour-3-beguiling-magic`. Include the level to ensure uniqueness when a subclass has multiple features at the same level.
- **name** — the feature name from the header (after "Level N: ").
- **level** — parse the number from the header. Handle variants:
  - `### Level 3: Feature` → level 3
  - `### 3rd Level: Feature` → level 3
  - `### 3rd-Level Feature` → level 3
- **class** — derived from filename prefix, mapped to exact class object.
- **subclass** — derived from filename and subclass name in H1, mapped to exact subclass object.
- **parent** — for Eldritch Invocations or Metamagic options, reference to the main feature (e.g., `eldritch-invocations`). Omit for normal subclass features.
- **desc** — feature description paragraphs as array of strings. Strip Markdown emphasis but keep bold labels inline. Stop at the next `### Level` header or end of file.
- **prerequisites** — parse from "Prerequisite:" or "Prerequisites:" lines if present. Each prerequisite is an object:
  - `{ "type": "level", "level": 5 }` for level requirements
  - `{ "type": "feature", "feature": "pact-of-the-blade" }` for feature requirements
  - `{ "type": "spell", "spell": "eldritch-blast" }` for spell requirements
  - `{ "type": "proficiency", "proficiency": "martial-weapons" }` for proficiency requirements
  - Empty array `[]` if no prerequisites.
- **feature_specific** — when the feature's prose presents a **"choose N from a closed set"** over one of the taxonomies in [Option choices](#option-choices-feature_specific), emit the structured options there. Omit for standard features.
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

Input (`data/md/subclass/bard--college-of-glamour.md`) contains:

```
### Level 3: Beguiling Magic

You always have the Charm Person and Mirror Image spells prepared. In addition, immediately after you cast an Enchantment spell, you can cause a creature you can see within 60 feet of yourself to make a Wisdom saving throw against your spell save DC. On a failed save, the target is Charmed or Frightened by you (your choice) for 1 minute.

### Level 3: Mantle of Inspiration

As a Bonus Action, you can expend a use of Bardic Inspiration, rolling your Bardic Inspiration die...
```

Output (`data/out/feature/college-of-glamour-3-beguiling-magic.json`):

```json
{
  "index": "college-of-glamour-3-beguiling-magic",
  "name": "Beguiling Magic",
  "level": 3,
  "class": {
    "index": "bard",
    "name": "Bard",
    "url": "/api/2024/classes/bard"
  },
  "subclass": {
    "index": "college-of-glamour",
    "name": "College of Glamour",
    "url": "/api/2024/subclasses/college-of-glamour"
  },
  "desc": [
    "You always have the Charm Person and Mirror Image spells prepared. In addition, immediately after you cast an Enchantment spell, you can cause a creature you can see within 60 feet of yourself to make a Wisdom saving throw against your spell save DC. On a failed save, the target is Charmed or Frightened by you (your choice) for 1 minute."
  ],
  "prerequisites": [],
  "url": "/api/2024/features/college-of-glamour-3-beguiling-magic"
}
```

Output (`data/out/feature/college-of-glamour-3-mantle-of-inspiration.json`):

```json
{
  "index": "college-of-glamour-3-mantle-of-inspiration",
  "name": "Mantle of Inspiration",
  "level": 3,
  "class": {
    "index": "bard",
    "name": "Bard",
    "url": "/api/2024/classes/bard"
  },
  "subclass": {
    "index": "college-of-glamour",
    "name": "College of Glamour",
    "url": "/api/2024/subclasses/college-of-glamour"
  },
  "desc": [
    "As a Bonus Action, you can expend a use of Bardic Inspiration, rolling your Bardic Inspiration die..."
  ],
  "prerequisites": [],
  "url": "/api/2024/features/college-of-glamour-3-mantle-of-inspiration"
}
```

## Prerequisite parsing example

If a feature has:

```
**Prerequisite:** 5th level, Pact of the Blade
```

The prerequisites array would be:

```json
"prerequisites": [
  { "type": "level", "level": 5 },
  { "type": "feature", "feature": "pact-of-the-blade" }
]
```

## Option choices (`feature_specific`)

Some features let the character **choose N options from a closed set** that already exists as
entities in the dataset (feats, skill proficiencies, weapons). When a feature's prose describes
such a pick, capture it as machine-readable `feature_specific` **in addition to** leaving the
prose in `desc`. **Read the prose and decide** — only emit `feature_specific` for a genuine
"choose from this set" over one of the three patterns below; the count comes from the text.

**Judgement, not pattern-matching on the name.** A feature can mention skills/weapons without
offering a pick (e.g. Assassin's _Infiltration Expertise_ = "Masterful Mimicry / Roving Aim" — a
fixed benefit, **not** a skill choice → no `feature_specific`). And a generic/class-less record
that grants the mechanic without stating a number (e.g. a bare `weapon-mastery` that just says
"certain weapons with which you have proficiency") states no count → **omit** `feature_specific`.

Copy option `item` refs **verbatim** from the tables below (this is what makes them resolve in
the referential-integrity test). `url` is `/api/2024/<segment>/<index>` for each.

### Pattern 1 — Fighting Style → `subfeature_options`

Prose like "You gain a **Fighting Style feat** of your choice." → choose 1 (or the stated number)
from the Fighting Style feats. An inline _alternative_ that isn't one of these feats (Paladin's
"Blessed Warrior", Ranger's "Druidic Warrior" — learn two cantrips instead) is **not** a
referenceable entity, so it stays in `desc` only; don't invent a ref for it.

```jsonc
"feature_specific": {
  "subfeature_options": {
    "choose": 1,
    "type": "feat",
    "from": {
      "option_set_type": "options_array",
      "options": [
        { "option_type": "reference", "item": { "index": "archery", "name": "Archery", "url": "/api/2024/feats/archery" } }
        // ... all ten below
      ]
    }
  }
}
```

Fighting Style feats (`url` = `/api/2024/feats/<index>`):

| index                  | name                   |
| ---------------------- | ---------------------- |
| archery                | Archery                |
| blind-fighting         | Blind Fighting         |
| defense                | Defense                |
| dueling                | Dueling                |
| great-weapon-fighting  | Great Weapon Fighting  |
| interception           | Interception           |
| protection             | Protection             |
| thrown-weapon-fighting | Thrown Weapon Fighting |
| two-weapon-fighting    | Two Weapon Fighting    |
| unarmed-fighting       | Unarmed Fighting       |

### Pattern 2 — Expertise → `expertise_options`

Prose like "You gain Expertise in **two of your skill proficiencies** of your choice." → choose
the stated number (usually 2) from the skill proficiencies. `type` is `"proficiency"` and the
refs point at proficiencies, **not** the skills taxonomy.

```jsonc
"feature_specific": {
  "expertise_options": {
    "choose": 2,
    "type": "proficiency",
    "from": {
      "option_set_type": "options_array",
      "options": [
        { "option_type": "reference", "item": { "index": "skill-acrobatics", "name": "Skill: Acrobatics", "url": "/api/2024/proficiencies/skill-acrobatics" } }
        // ... all eighteen below
      ]
    }
  }
}
```

Skill proficiencies (`url` = `/api/2024/proficiencies/<index>`):

| index                 | name                   |     | index                 | name                   |
| --------------------- | ---------------------- | --- | --------------------- | ---------------------- |
| skill-acrobatics      | Skill: Acrobatics      |     | skill-medicine        | Skill: Medicine        |
| skill-animal-handling | Skill: Animal Handling |     | skill-nature          | Skill: Nature          |
| skill-arcana          | Skill: Arcana          |     | skill-perception      | Skill: Perception      |
| skill-athletics       | Skill: Athletics       |     | skill-performance     | Skill: Performance     |
| skill-deception       | Skill: Deception       |     | skill-persuasion      | Skill: Persuasion      |
| skill-history         | Skill: History         |     | skill-religion        | Skill: Religion        |
| skill-insight         | Skill: Insight         |     | skill-sleight-of-hand | Skill: Sleight of Hand |
| skill-intimidation    | Skill: Intimidation    |     | skill-stealth         | Skill: Stealth         |
| skill-investigation   | Skill: Investigation   |     | skill-survival        | Skill: Survival        |

### Pattern 3 — Weapon Mastery → `subfeature_options`

Prose like "you can use the mastery properties of **three** kinds of Simple or Martial weapons of
your choice." → `choose` = the number stated **in this feature's prose** (it differs by class:
Fighter 3, Barbarian/Paladin/Monk/Rogue 2, etc.), `type` `"equipment"`, from the weapons that have
a mastery property. **If the prose restricts the kind** — "Simple or Martial **Melee** weapons"
(Barbarian) — include only the **melee** weapons; an unrestricted "Simple or Martial weapons"
(Fighter) includes all of them.

Weapons with a mastery property (`url` = `/api/2024/equipment/<index>`; **M** = melee, **R** =
ranged — drop the **R** rows when the prose says "Melee"):

| index     | name      | kind | index          | name           | kind | index        | name         | kind |
| --------- | --------- | ---- | -------------- | -------------- | ---- | ------------ | ------------ | ---- |
| battleaxe | Battleaxe | M    | greatsword     | Greatsword     | M    | morningstar  | Morningstar  | M    |
| blowgun   | Blowgun   | R    | halberd        | Halberd        | M    | musket       | Musket       | R    |
| club      | Club      | M    | hand-crossbow  | Hand Crossbow  | R    | pike         | Pike         | M    |
| dagger    | Dagger    | M    | handaxe        | Handaxe        | M    | pistol       | Pistol       | R    |
| dart      | Dart      | R    | heavy-crossbow | Heavy Crossbow | R    | quarterstaff | Quarterstaff | M    |
| flail     | Flail     | M    | javelin        | Javelin        | M    | rapier       | Rapier       | M    |
| glaive    | Glaive    | M    | lance          | Lance          | M    | scimitar     | Scimitar     | M    |
| greataxe  | Greataxe  | M    | light-crossbow | Light Crossbow | R    | shortbow     | Shortbow     | R    |
| greatclub | Greatclub | M    | light-hammer   | Light Hammer   | M    | shortsword   | Shortsword   | M    |
|           |           |      | longbow        | Longbow        | R    | sickle       | Sickle       | M    |
|           |           |      | longsword      | Longsword      | M    | sling        | Sling        | R    |
|           |           |      | mace           | Mace           | M    | spear        | Spear        | M    |
|           |           |      | maul           | Maul           | M    | trident      | Trident      | M    |
|           |           |      |                |                |      | war-pick     | War Pick     | M    |
|           |           |      |                |                |      | warhammer    | Warhammer    | M    |
|           |           |      |                |                |      | whip         | Whip         | M    |

> Scaling counts (the Fighter/Barbarian tables grant more masteries at higher levels) are tracked
> per-level on the Level records, not here — use the base count stated in this feature's prose.

## Spell grants (`feature_specific.spellcasting`)

Some features let you **cast specific, named spells** outside your normal spellcasting — an
Eldritch Invocation ("You can cast _Mage Armor_ on yourself without expending a spell slot"), or a
subclass grant ("You always have the _Hex_ spell prepared"). Capture these as
`feature_specific.spellcasting` **in addition to** leaving the prose in `desc`, so a builder can
list the spell on the sheet.

**Only emit `spellcasting` for a grant of one or more _named_ spells.** Read the prose:

- ✅ **Emit** when the text names the spell(s) you gain — "cast _Silent Image_ without expending a
  spell slot", "always have _Charm Person_ and _Mirror Image_ prepared", "you learn the _Find
  Familiar_ spell and can cast it … without expending a spell slot".
- ❌ **Skip — patron/domain/circle spell tables.** A feature named "_<X>_ Spells" (e.g. Fiend
  Spells, Grave Domain Spells, Archfey Spells) that grants a **table** of always-prepared spells by
  level is **already captured on the subclass's `spells` list** — do **not** duplicate it here.
- ❌ **Skip — "of your choice" / "choose one".** "Learn two spells of your choice", "choose any
  Cleric spell" (Magical Discoveries, Spell Mastery, Mystic Arcanum) is a _pick_, not a fixed
  grant. This also covers **"choose one of the following benefits"** features where casting a named
  spell is merely one option among several (e.g. the Diviner's _The Third Eye_ — Darkvision /
  Greater Comprehension / See Invisibility): the spell isn't granted outright, so emit no
  `spellcasting` — leave it in `desc` only.
- ❌ **Skip — conditional riders.** "When you cast an Enchantment spell, …", "After you cast a
  spell, …" modify your own casting; they grant no spell.

### Fields

For each granted spell, emit `{ spell, usage, times?, self_only? }`:

- **spell** — the real spell entity ref. Slugify the spell name and confirm the file
  `data/out/spell/<index>.json` exists; `url` = `/api/2024/spells/<index>`. Never invent a spell
  that isn't in the dataset.
- **usage** — a feature often states more than one economy for the same spell; decide by this
  **priority** (the first that applies wins; any remaining economy stays in `desc`):
  1. `"always_prepared"` — the prose says "you always have _X_ prepared" / "always have _X_ ready".
     **This wins even when the feature ALSO grants a limited number of slotless casts** (e.g. "You
     always have Hunter's Mark prepared. You can cast it twice without expending a spell slot …" →
     `always_prepared`). Being always prepared is the headline; the free-cast count stays in `desc`.
  2. `"per_long_rest"` — the spell is granted **only** as a limited number of free (slotless) casts
     and is **not** also said to be always prepared ("you can cast _X_ **once** without expending a
     spell slot, regaining … on a Long Rest"). Set **`times`** to a fixed integer ("once" → 1); omit
     `times` when the count is a variable (an ability modifier) and leave that detail in `desc`.
  3. `"at_will"` — "cast _X_ without expending a spell slot" with **no** stated per-rest limit.
- **self_only** — `true` when the free cast targets only you ("on yourself"). Omit otherwise.
- **ability** (on the parent `spellcasting` object) — omit; the spell uses the granting class's own
  spellcasting ability. Include only if the text names a specific, different ability.

When a feature grants several spells with the same economy, list them all (Beguiling Magic →
`Charm Person` + `Mirror Image`, both `always_prepared`).

### Examples

`eldritch-invocation-armor-of-shadows` — "You can cast Mage Armor on yourself without expending a
spell slot.":

```jsonc
"feature_specific": {
  "spellcasting": {
    "spells": [
      { "spell": { "index": "mage-armor", "name": "Mage Armor", "url": "/api/2024/spells/mage-armor" }, "usage": "at_will", "self_only": true }
    ]
  }
}
```

`eldritch-invocation-gift-of-the-depths` — "You can also cast Water Breathing once without
expending a spell slot." → `usage: "per_long_rest"`, `times: 1` (the swim-speed half stays in
`desc`):

```jsonc
"feature_specific": {
  "spellcasting": {
    "spells": [
      { "spell": { "index": "water-breathing", "name": "Water Breathing", "url": "/api/2024/spells/water-breathing" }, "usage": "per_long_rest", "times": 1 }
    ]
  }
}
```

`great-old-one-patron-10-eldritch-hex` — "You always have the Hex spell prepared.":

```jsonc
"feature_specific": {
  "spellcasting": {
    "spells": [
      { "spell": { "index": "hex", "name": "Hex", "url": "/api/2024/spells/hex" }, "usage": "always_prepared" }
    ]
  }
}
```

## Parent-linked option records (Invocations / Metamagic / Maneuvers)

A few features grant a pick from a large, class-specific list that has **no entities yet** — the
Warlock's **Eldritch Invocations**, the Sorcerer's **Metamagic**, the Battle Master's **Maneuvers**.
Each option becomes its **own Feature record** with a `parent` ref back to the granting feature, and
the parent feature gets a `feature_specific` that lists them. (This is the only way the picks can be
machine-readable: `feature_specific` must point at entities that exist.)

The options live on dedicated sources:

| Set        | Source markdown                                                                      | Option index / name                                          | Parent feature index                 | class / subclass        |
| ---------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------------------------ | ----------------------- |
| Invocation | `data/md/invocation/invocation.md` (`### <Name>`)                                    | `eldritch-invocation-<slug>` / "Eldritch Invocation: <Name>" | `eldritch-invocations`               | warlock                 |
| Metamagic  | `data/md/metamagic/metamagic.md` (`### <Name>`)                                      | `metamagic-<slug>` / "Metamagic: <Name>"                     | `metamagic`                          | sorcerer                |
| Maneuver   | `data/md/subclass/fighter--battle-master.md`, "### Maneuver Options" (`**<Name>.**`) | `maneuver-<slug>` / "Maneuver: <Name>"                       | `battle-master-3-combat-superiority` | fighter / battle-master |

### Each option Feature record

- **index / name** — per the table (`slugify(<Name>)`; see [slugify](#slugify)).
- **level** — the minimum level the option can be taken: an invocation's **prerequisite level**
  (e.g. "Level 5+ Warlock" → 5), or **1** if it has no level prerequisite; **2** for every
  Metamagic option (Sorcerer gains Metamagic at level 2); **3** for every Maneuver.
- **class** — warlock / sorcerer / fighter (exact objects in the [class references](#exact-class-references) table). **subclass** — only Maneuvers carry one (`battle-master`).
- **parent** — the parent feature ref from the table, e.g. `{ "index": "eldritch-invocations", "name": "Eldritch Invocations", "url": "/api/2024/features/eldritch-invocations" }`.
- **desc** — the option's prose paragraphs (strip the `Source:` and `_Prerequisite:_` lines).
- **prerequisites** — parse the `_Prerequisite: …_` line (invocations only):
  - "Level N+ Warlock" → `{ "type": "level", "level": N }`.
  - "<Name> Invocation" (a prereq invocation, e.g. "Pact of the Blade Invocation") → `{ "type": "feature", "feature": "eldritch-invocation-<slug>" }` (use the SAME index convention so it points at the real record).
  - A free-text condition that isn't a level/feature/spell/proficiency (e.g. "a Warlock Cantrip That Deals Damage") can't be expressed by the prerequisite schema — omit it (it stays in `desc`). `[]` if no prerequisite line.
- **feature_specific** — when the option lets you cast a **named spell** (many invocations do —
  Armor of Shadows → Mage Armor, Misty Visions → Silent Image), emit
  `feature_specific.spellcasting` per [Spell grants](#spell-grants-feature_specificspellcasting).
  Omit for options that grant no spell.
- **url** — `/api/2024/features/<index>`.

### Wiring the parent's `feature_specific`

After writing the option records, set the parent feature's `feature_specific` to reference **all**
of them (refs only — `{ index, name, url }`):

- **`eldritch-invocations`** → `{ "invocations": [ <ref to every eldritch-invocation-*> ] }` (a flat
  catalog; the per-level count lives on the Level records' `class_specific.invocations_known`).
- **`metamagic`** → `{ "subfeature_options": { "choose": 2, "type": "feature", "from": { "option_set_type": "options_array", "options": [ { "option_type": "reference", "item": <ref> }, … ] } } }` (Sorcerer's initial grant is 2).
- **`battle-master-3-combat-superiority`** → same `subfeature_options` shape with `"choose": 3` (the Battle Master learns 3 maneuvers at level 3).

Preserve every other field of the parent record; only add `feature_specific`.
