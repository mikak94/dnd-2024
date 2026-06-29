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
  // "repeatable": true,     // omit unless the section has a "Repeatable." note — see Repeatable & choices
  // "choices": [ ... ],     // omit unless the feature has an in-feature pick — see Repeatable & choices
  // "activation": { ... },  // omit for passive features — see Activation & recharge
  // "recharge": { ... },    // omit when unlimited — see Activation & recharge
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
- **desc** — feature description paragraphs as array of strings. Strip Markdown emphasis but keep bold labels inline. Stop at the next `### Level` header or end of file. If the section contains a table or option list whose entries are NOT modeled in `feature_specific` (a circle/land spell-by-level table, a random d6/d12 effect table, a "roll on the table" menu, etc.), **preserve it verbatim in `desc`** (keep the Markdown table rows or numbered list) — never drop or lossy-summarize table data. Only summarize a table in prose when its options ARE captured in `feature_specific`.
- **prerequisites** — parse from "Prerequisite:" or "Prerequisites:" lines if present. Each prerequisite is an object:
  - `{ "type": "level", "level": 5 }` for level requirements
  - `{ "type": "feature", "feature": "pact-of-the-blade" }` for feature requirements
  - `{ "type": "spell", "spell": "eldritch-blast" }` for spell requirements
  - `{ "type": "proficiency", "proficiency": "martial-weapons" }` for proficiency requirements
  - Empty array `[]` if no prerequisites.
- **activation** — how the character activates this feature. Emit ONLY for features that require an action to use; omit for passive/always-on features (resistances, proficiency grants, flat bonuses, etc.). See [Activation & recharge](#activation--recharge).
- **recharge** — when the feature's uses reset. Emit ONLY for features with a stated cap ("once per Short Rest", "a number of times equal to your Proficiency Bonus per Long Rest"). See [Activation & recharge](#activation--recharge).
- **feature_specific** — when the feature's prose presents a **"choose N from a closed set"** over one of the taxonomies in [Option choices](#option-choices-feature_specific), OR a **"choose one of the following benefits"** menu (see [Benefit options](#benefit-options-feature_specificbenefit_options)), emit the structured data there. Omit for standard features.
- **repeatable** — `true` when the section carries a **"Repeatable."** note ("You can gain this invocation more than once"); omit otherwise. See [Repeatable & choices](#repeatable--choices).
- **choices** — for in-feature player picks expressed as the shared `ChoiceSchema` (an invocation's "choose one of your known Warlock cantrips that …", or "choose an Origin feat"). Omit when the feature has none. See [Repeatable & choices](#repeatable--choices). This is distinct from `feature_specific.subfeature_options`/`expertise_options`, which model **closed enumerated entity sets** (Fighting Style / Expertise / Weapon Mastery).
- **armor_class** — the feature's effect on Armor Class, when it has a *deterministic* one (an Unarmored Defense formula or a flat bonus). Omit otherwise. See [Armor Class](#armor-class-armor_class).
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

## Activation & recharge

### `activation`

Emit `activation` whenever the character must explicitly choose to use a feature by spending an
action. Do **not** emit it for features that trigger automatically, grant passive bonuses, or add
to an existing action (e.g. "when you hit with an attack, you can also …").

```jsonc
"activation": {
  "action_type": "bonus_action",  // "action" | "bonus_action" | "reaction" | "free_action" | "special"
  "cost": "bardic_inspiration",   // omit when the action type alone is the cost
}
```

**`action_type` rules:**

| Text phrase                                      | `action_type`  |
| ------------------------------------------------ | -------------- |
| "As a Bonus Action, …" / "you can … as a Bonus Action" | `"bonus_action"` |
| "As an Action, …" / "you can use your action to …"     | `"action"`       |
| "As a Reaction, …"                              | `"reaction"`   |
| "as part of the Attack action" / "as part of another action" | `"free_action"` |
| Non-standard timing ("when you roll initiative", "on your turn") | `"special"` |

**`cost` rules** — emit only these canonical tokens; anything else stays in `desc` only:

| Text phrase                            | `cost` token          |
| -------------------------------------- | --------------------- |
| "expend a use of Bardic Inspiration" / "expend a Bardic Inspiration die" | `"bardic_inspiration"` |
| "expend your Channel Divinity"         | `"channel_divinity"`  |
| "expend 1 Focus Point" / "spend Focus Points" | `"focus_point"` |
| "expend a Psionic Energy die" / "spend Psionic Energy dice" | `"psionic_energy"` |
| "enter a Rage" (per use)               | `"rage"`              |
| "spend Sorcery Points"                 | `"sorcery_point"`     |
| "expend a spell slot"                  | `"spell_slot"`        |
| "expend a Superiority Die"             | `"superiority_die"`   |
| "use your Wild Shape"                  | `"wild_shape"`        |

When a feature has BOTH an action type AND a cost (e.g. "As a Bonus Action, you can expend a use
of Bardic Inspiration …"), emit both. When the feature has a cost but no explicit action type
(e.g. "You can expend Focus Points to …" with no stated action), use `"special"`.

### `recharge`

Emit `recharge` when the feature has a **stated limit on uses** that **resets** on a rest or similar
event. Do not emit for:
- Unlimited use ("whenever you do X, you can …" with no cap)
- Once-per-activation-cost features where the cost itself limits use (Focus Point, spell slot, etc.)
- "Until you start a Short or Long Rest" duration language (that's a **duration**, not a recharge)

```jsonc
"recharge": {
  "condition": "short_or_long_rest",  // "short_rest" | "long_rest" | "short_or_long_rest" | "dawn" | "turn"
  "uses": 1,                          // omit when count is variable (stays in desc)
}
```

**`condition` rules:**

| Text phrase                                     | `condition`            |
| ----------------------------------------------- | ---------------------- |
| "until you finish a Short Rest"                 | `"short_rest"`         |
| "until you finish a Long Rest"                  | `"long_rest"`          |
| "until you finish a Short or Long Rest"         | `"short_or_long_rest"` |
| "at dawn" / "each dawn"                         | `"dawn"`               |
| "until the start/end of your next turn"         | `"turn"`               |

**`uses` rules:** set to the stated integer ("once" → 1, "twice" → 2). Omit when the count is
expressed as a formula ("a number of times equal to your Proficiency Bonus", "your Charisma
modifier times per Long Rest") — leave those details in `desc`.

### When both `activation` and `recharge` apply

Most active features need both. The Third Eye: "As a Bonus Action … You can't use this feature
again until you finish a Short or Long Rest" →

```jsonc
"activation": { "action_type": "bonus_action" },
"recharge":   { "condition": "short_or_long_rest", "uses": 1 },
```

Bardic Inspiration: "As a Bonus Action, you can inspire another creature …" (no stated hard cap
beyond the die economy, which tracks separately on level records) → emit `activation` only, no
`recharge`.

## Armor Class (`armor_class`)

Set `armor_class` when the feature changes how Armor Class is computed in a **deterministic** way. Two shapes, discriminated by `calculation`:

- **`unarmored_defense`** — "while you aren't wearing armor, your base Armor Class equals B plus your <Ability> modifier (plus your <Ability> modifier)". This is the Barbarian/Monk Unarmored Defense pattern and its subclass variants. Fields:
  - `base` — B (almost always 10).
  - `abilities` — the ability-score refs added to `base`, **in the order written** (DEX first). Use the reference objects in the table below, verbatim.
  - `shield_allowed` — `true` only if the text also permits a Shield ("You can use a Shield and still gain this benefit"); `false` when it says "while you aren't wearing armor **or wielding a Shield**".
- **`flat_bonus`** — "you gain a +N bonus to Armor Class". Fields: `bonus` (integer N at the level gained — later scaling stays in `desc`) and `armor`: `"armored"` (only while wearing Light/Medium/Heavy armor), `"unarmored"` (only while wearing none), or `"any"` (unconditional). When the bonus is granted only by an activated form/stance, ALSO emit the feature's `activation` as usual — `armor_class` and `activation` coexist.

**Leave the effect in `desc` and OMIT `armor_class`** when it is choice-dependent (the ability isn't fixed), random, or only sets AC inside a special form — a Wild Shape AC ("your AC equals 13 + your Wisdom modifier"), a die-roll bonus (Bait and Switch's Superiority Die to AC), or a random surge-table row. A separate creature's stat-block AC (a companion/summon) is that creature's, not the character's — never model it here.

### Ability-score references (copy verbatim)

| Ability | Object |
| --- | --- |
| Strength | `{"index":"str","name":"STR","url":"/api/2024/ability-scores/str"}` |
| Dexterity | `{"index":"dex","name":"DEX","url":"/api/2024/ability-scores/dex"}` |
| Constitution | `{"index":"con","name":"CON","url":"/api/2024/ability-scores/con"}` |
| Intelligence | `{"index":"int","name":"INT","url":"/api/2024/ability-scores/int"}` |
| Wisdom | `{"index":"wis","name":"WIS","url":"/api/2024/ability-scores/wis"}` |
| Charisma | `{"index":"cha","name":"CHA","url":"/api/2024/ability-scores/cha"}` |

### Examples

Draconic Resilience — _"While you aren't wearing armor, your base Armor Class equals 10 plus your Dexterity and Charisma modifiers."_ (no Shield clause → a Shield is still allowed):

```jsonc
"armor_class": {
  "calculation": "unarmored_defense",
  "base": 10,
  "abilities": [
    { "index": "dex", "name": "DEX", "url": "/api/2024/ability-scores/dex" },
    { "index": "cha", "name": "CHA", "url": "/api/2024/ability-scores/cha" }
  ],
  "shield_allowed": true
}
```

Monk Unarmored Defense — _"While you aren't wearing armor or wielding a Shield, your base Armor Class equals 10 plus your Dexterity and Wisdom modifiers."_ → same shape with `abilities` `[dex, wis]` and `"shield_allowed": false`.

Wrath of the Wild (Ancient Armor) — _"You gain a +1 bonus to AC … This bonus increases to +2 when you reach Ranger level 11"_, granted by a Bonus-Action transformation → record the level-3 value and keep `activation`:

```jsonc
"activation": { "action_type": "bonus_action" },
"armor_class": { "calculation": "flat_bonus", "bonus": 1, "armor": "any" }
```

## Benefit options (`feature_specific.benefit_options`)

Some features offer a **"choose one of the following benefits"** menu where the options are
heterogeneous — mixing passive mechanical benefits (Darkvision, read any language) with spell
casts (See Invisibility). These are NOT a closed entity list (unlike Fighting Style / Expertise /
Weapon Mastery), so use `benefit_options` instead of `subfeature_options`.

Emit `feature_specific.benefit_options` when:
- ✅ The selection happens **at activation time** — "choose one of the following options" each time
  you use the feature, or "whenever you activate your Rage, you gain one of the following options
  of your choice." This is a runtime per-use pick, not a character-creation choice.
- ✅ The options are inline (not entity refs — not Fighting Style feats, skill proficiencies, etc.).

Do NOT emit for:
- ❌ **Permanent or semi-permanent picks** made once (even if changeable): "You gain one of the
  following options of your choice" with no per-activation trigger (Blessed Strikes, Elemental
  Fury, Aspect of the Wilds "Whenever you finish a Long Rest, you can change your choice") —
  leave those in `desc` only. The difference from The Third Eye is that the user doesn't choose
  on every activation; they pick once and keep it.
- ❌ Patron/domain/circle spell tables or "always prepared" lists (modeled elsewhere).
- ❌ "choose N from a closed set" of named entities (Fighting Style / Expertise / Weapon Mastery
  → use `subfeature_options` instead).

### Shape

```jsonc
"feature_specific": {
  "benefit_options": {
    "choose": 1,
    "benefits": [
      { "type": "passive", "name": "Darkvision", "desc": "You gain Darkvision with a range of 120 feet." },
      { "type": "passive", "name": "Greater Comprehension", "desc": "You can read any language." },
      { "type": "spell", "name": "See Invisibility", "spell": { "index": "see-invisibility", "name": "See Invisibility", "url": "/api/2024/spells/see-invisibility" } }
    ]
  }
}
```

**Benefit `type` rules:**

- `"passive"` — a fixed mechanical effect with no spell cast. Set `desc` to the one-sentence
  summary from the text (keep bold label in `name`, strip it from `desc`).
- `"spell"` — the option is "cast \<Spell\> without expending a spell slot" or similar. Set `spell`
  to the real spell entity ref. The `desc` field is optional (omit if the name is self-explanatory).
  Do **not** add a `casting_time_override` — the casting time for a spell benefit is always the
  feature's own `activation.action_type` (a Bonus Action feature casts its spell benefit as a
  Bonus Action, regardless of the spell's normal casting time).

Verify the spell file `data/out/spell/<index>.json` exists before referencing it. Never invent a
spell that isn't in the dataset.

## Repeatable & choices

Some features (mostly Eldritch Invocations) can be taken more than once and/or require the
player to make a pick when they take them. Two independent fields capture this:

### `repeatable`

Set `"repeatable": true` whenever the section contains a **"Repeatable."** note — the exact
sentence is "You can gain this invocation more than once. Each time you do so, choose a different
…". Omit the field otherwise. Keep the "Repeatable." sentence in `desc` as well (it's still prose).

Four invocations are repeatable: Agonizing Blast, Eldritch Spear, Repelling Blast, and Lessons of
the First Ones.

### `choices`

When a feature tells the player to **choose something** as part of taking it — and the pick is NOT
one of the closed enumerated sets in [Option choices](#option-choices-feature_specific) (Fighting
Style / Expertise / Weapon Mastery, which use `feature_specific`) — capture it as a `choices`
array of `ChoiceSchema` (the same shape used by Feat `choices` and Trait `feat_options`). Leave the
prose in `desc` too. Each distinct pick is one Choice.

**A "choose one of your known Warlock cantrips that …" pick (Agonizing Blast / Eldritch Spear /
Repelling Blast)** is a `type: "spells"` choice. The pool is the Warlock cantrip list
(`resource_list_url: "/api/2024/classes/warlock/spells"`); the eligibility clause becomes a
structured `spell_source` so a builder can narrow the picker to eligible **known** cantrips:

| Prose clause                                       | `spell_source` field             |
| -------------------------------------------------- | -------------------------------- |
| a Warlock cantrip (always)                         | `"level": 0, "classes": ["warlock"]` |
| "that requires an attack roll" (Repelling Blast)   | `"requires_attack_roll": true`   |
| "that deals damage" (Agonizing / Eldritch Spear)   | `"deals_damage": true`           |
| "has a range of 10+ feet" (Eldritch Spear)         | `"min_range_feet": 10`           |

```jsonc
"choices": [
  {
    "desc": "Choose one of your known Warlock cantrips that requires an attack roll.",
    "choose": 1,
    "type": "spells",
    "spell_source": { "level": 0, "classes": ["warlock"], "requires_attack_roll": true },
    "from": { "option_set_type": "resource_list", "resource_list_url": "/api/2024/classes/warlock/spells" }
  }
]
```

**A "choose an Origin feat" pick (Lessons of the First Ones)** is a `type: "feats"` choice over a
`resource_list` (identical to the Human Versatile trait's `feat_options`):

```jsonc
"choices": [
  {
    "desc": "Choose one Origin feat.",
    "choose": 1,
    "type": "feats",
    "from": { "option_set_type": "resource_list", "resource_list_url": "/api/2024/feats?type=origin" }
  }
]
```

Do **not** emit `choices` for a non-pick — Devil's Sight, Eldritch Mind, Pact of the Blade's "weapon
of your choice" detail that isn't drawn from a referenceable set, etc. stay in `desc` only.

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
  "activation": { "action_type": "bonus_action", "cost": "bardic_inspiration" },
  "url": "/api/2024/features/college-of-glamour-3-mantle-of-inspiration"
}
```

### The Third Eye (benefit_options example)

Input (`data/md/subclass/wizard--diviner.md`):

```
### level 10: The Third Eye

You can increase your powers of perception. As a Bonus Action, choose one of the following
benefits, which lasts until you start a Short or Long Rest. You can't use this feature again
until you finish a Short or Long Rest.

**Darkvision.** You gain Darkvision with a range of 120 feet.

**Greater Comprehension.** You can read any language.

**See Invisibility.** You can cast See Invisibility without expending a spell slot.
```

Output (`data/out/feature/diviner-10-the-third-eye.json`):

```json
{
  "index": "diviner-10-the-third-eye",
  "name": "The Third Eye",
  "level": 10,
  "class": {
    "index": "wizard",
    "name": "Wizard",
    "url": "/api/2024/classes/wizard"
  },
  "subclass": {
    "index": "diviner",
    "name": "Diviner",
    "url": "/api/2024/subclasses/diviner"
  },
  "desc": [
    "You can increase your powers of perception. As a Bonus Action, choose one of the following benefits, which lasts until you start a Short or Long Rest. You can't use this feature again until you finish a Short or Long Rest.",
    "Darkvision. You gain Darkvision with a range of 120 feet.",
    "Greater Comprehension. You can read any language.",
    "See Invisibility. You can cast See Invisibility without expending a spell slot."
  ],
  "prerequisites": [],
  "activation": { "action_type": "bonus_action" },
  "recharge": { "condition": "short_or_long_rest", "uses": 1 },
  "feature_specific": {
    "benefit_options": {
      "choose": 1,
      "benefits": [
        { "type": "passive", "name": "Darkvision", "desc": "You gain Darkvision with a range of 120 feet." },
        { "type": "passive", "name": "Greater Comprehension", "desc": "You can read any language." },
        {
          "type": "spell",
          "name": "See Invisibility",
          "spell": {
            "index": "see-invisibility",
            "name": "See Invisibility",
            "url": "/api/2024/spells/see-invisibility"
          }
        }
      ]
    }
  },
  "url": "/api/2024/features/diviner-10-the-third-eye"
}
```

Key points:
- `activation.action_type` is `"bonus_action"` (the feature costs a Bonus Action).
- `recharge` is set because "You can't use this feature again until you finish a Short or Long Rest."
- The "lasts until you start a Short or Long Rest" phrase is a **duration**, not the recharge — it goes in `desc` only.
- See Invisibility is a `"spell"` benefit. Its normal casting time (Action) is irrelevant here — casting it as part of The Third Eye costs a Bonus Action because that's the feature's `activation.action_type`.
- No `casting_time_override` on the spell benefit — the rule is implicit: spell benefits cost the feature's action type.

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
- ✅ **Emit even when the cast is conditional or resource-gated**, as long as the feature is what
  gives you access to a spell you wouldn't otherwise have: "**you can cast** _Misty Step_ as a
  Reaction", "immediately after you cast an Enchantment spell, **you can cast** _Misty Step_ without a
  slot", "you can cast _Commune with Nature_ but only as a Ritual", "spend 3 Sorcery Points to
  **cast** _Summon Beast_ … **without preparing the spell**". The trigger/cost stays in `desc`; the
  grant is still real. Pick `usage` by the cap (no per-rest cap → `at_will`; once-per-rest →
  `per_long_rest` + `times`). Name the `ability` only when the text states one explicitly.
- ❌ **Skip — patron/domain/circle spell tables.** A feature named "_<X>_ Spells" (e.g. Fiend
  Spells, Grave Domain Spells, Archfey Spells) that grants a **table** of always-prepared spells by
  level is **already captured on the subclass's `spells` list** — do **not** duplicate it here.
- ❌ **Skip — "of your choice" / "choose one".** "Learn two spells of your choice", "choose any
  Cleric spell" (Magical Discoveries, Spell Mastery, Mystic Arcanum) is a _pick_, not a fixed
  grant. This also covers **"choose one of the following benefits"** features where casting a named
  spell is one option among several (e.g. the Diviner's _The Third Eye_): use
  `feature_specific.benefit_options` for those — see [Benefit options](#benefit-options-feature_specificbenefit_options).
- ❌ **Skip — pure riders where the named spell is only the _trigger_.** "**When you cast** _Divine
  Smite_, you and your allies gain Half Cover", "**when you cast** _Hunter's Mark_, you gain Temp HP",
  "**when you cast** _Find Familiar_, the familiar gains …", "modify it so _Summon Aberration_ doesn't
  require Concentration". Here the spell is cast by some _other_ source and this feature just adds an
  effect or modifies it — it grants no new way to cast the spell. (Contrast the ✅ "you can cast _X_"
  cases above: the distinction is **"you can cast _X_"** = grant vs **"when you cast _X_, …"** = rider.)
- ❌ **Skip — alternate casting of a spell you already have prepared.** When the named spell is
  already on the subclass's `spells` table (a domain/patron/circle always-prepared spell) and the
  feature only lets you cast it via a different resource — "expend a use of Channel Divinity to cast
  _Shield of Faith_ rather than a spell slot" (War Domain's War God's Blessing) — it grants no new
  spell access; the spell is already surfaced from the subclass list. Keep the alternate-cast method
  in `desc` only. (Contrast _Summon Beast_ above, which is NOT on the Shadow Sorcery list → grant.)

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
- **casting_time_override** — present **only** when the text explicitly states the spell is cast
  with a different action type than its own `casting_time` (e.g. "you can cast \<X\> as a Bonus
  Action" when the spell normally costs an Action). Values: `"action"` | `"bonus_action"` |
  `"reaction"`. Omit in the common case (the spell is cast normally). For `benefit_options` spell
  entries, do **not** set this — the casting time is the feature's `activation.action_type`.
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
- **repeatable** — `true` when the option has a **"Repeatable."** note (Agonizing Blast, Eldritch
  Spear, Repelling Blast, Lessons of the First Ones); omit otherwise. See
  [Repeatable & choices](#repeatable--choices).
- **choices** — when the option says **"Choose one of your known Warlock cantrips that …"**
  (Agonizing Blast → `deals_damage`; Eldritch Spear → `deals_damage` + `min_range_feet: 10`;
  Repelling Blast → `requires_attack_roll`) or **"gain one Origin feat of your choice"** (Lessons of
  the First Ones), emit the `ChoiceSchema` pick per [Repeatable & choices](#repeatable--choices).
  Omit for options with no pick.
- **url** — `/api/2024/features/<index>`.

### Wiring the parent's `feature_specific`

After writing the option records, set the parent feature's `feature_specific` to reference **all**
of them (refs only — `{ index, name, url }`):

- **`eldritch-invocations`** → `{ "invocations": [ <ref to every eldritch-invocation-*> ] }` (a flat
  catalog; the per-level count lives on the Level records' `class_specific.invocations_known`).
- **`metamagic`** → `{ "subfeature_options": { "choose": 2, "type": "feature", "from": { "option_set_type": "options_array", "options": [ { "option_type": "reference", "item": <ref> }, … ] } } }` (Sorcerer's initial grant is 2).
- **`battle-master-3-combat-superiority`** → same `subfeature_options` shape with `"choose": 3` (the Battle Master learns 3 maneuvers at level 3).

Preserve every other field of the parent record; only add `feature_specific`.
