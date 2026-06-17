# Trait extraction spec (2024) — shared sub-spec

This is **not** run as a standalone category. It defines the per-Trait field rules applied
**within** the species and subspecies passes (see `species-extraction.md`,
`subspecies-extraction.md`): when an agent extracts a species/subspecies, it emits that
parent's traits in the same pass, writing each to `data/out/trait/<trait-index>.json`.
Running trait extraction inside the parent pass is what guarantees the parent's `traits[]`
refs and the Trait records share one slug. Extract only what the text states; never invent values.

Schema: `src/pipeline/schemas/trait-2024.ts`. Validate after with `npm run validate trait`.

## Deterministic slug rule (MUST match the parent's `traits[]` refs)

`slugify(s)`: lowercase; replace each run of non-alphanumeric characters with a single `-`;
trim leading/trailing `-`.

A trait's **index** is `<parent-index>-slugify(<trait name>)`, where `<parent-index>` is the
species or subspecies index it was found under. E.g. under species `dragonborn`, the
"Breath Weapon" trait → `dragonborn-breath-weapon`. The parent record's `traits[]` entry MUST
be `{ "index": "<that index>", "name": "<trait name>", "url": "/api/2024/traits/<that index>" }`.

## Output shape

```jsonc
{
  "index": "dragonborn-breath-weapon",
  "name": "Breath Weapon",
  "species": [
    {
      "index": "dragonborn",
      "name": "Dragonborn",
      "url": "/api/2024/species/dragonborn",
    },
  ],
  "subspecies": [], // populate instead of `species` when found under a subspecies
  "desc": [
    "When you take the Attack action on your turn, you can replace one attack...",
  ],
  "proficiencies": [], // optional; omit if none
  "proficiency_choices": null, // optional array of Choice (one per pick); omit if none
  "language_options": null, // optional Choice; omit if none
  "parent": null, // optional; e.g. a Draconic Ancestry variant -> its parent trait
  "trait_specific": {
    // optional; only the relevant sub-keys
    "damage_type": {
      "index": "fire",
      "name": "Fire",
      "url": "/api/2024/damage-types/fire",
    },
    "breath_weapon": {
      /* see below */
    },
  },
  "url": "/api/2024/traits/dragonborn-breath-weapon",
}
```

## Field rules

- **index** — the deterministic slug above.
- **name** — the trait's name (header text), verbatim.
- **species** — array with the parent species ref when the trait is found on a species page
  (or on a subspecies whose trait still belongs to the species). Empty otherwise.
- **subspecies** — array with the parent subspecies ref when found under a subspecies. Empty otherwise.
- **desc** — description paragraphs as an array of strings. Strip Markdown emphasis; keep bold labels inline.
- **proficiencies** — fixed granted proficiency refs (skills/tools/armor/weapons), if any. Omit if none.
  Use the exact `index`/`name` from the canonical proficiencies dataset
  (`data/out/5e-SRD-Proficiencies.json`) — skills are `skill-<…>` (name `Skill: <X>`); tools follow
  5e-database's inconsistent naming (bare `smiths-tools`/`disguise-kit` vs `tool-`-prefixed
  `tool-thieves-tools`), so look them up rather than inventing a slug. url `/api/2024/proficiencies/<index>`.
- **proficiency_choices** — an **array** of `Choice` (see ChoiceSchema in `common-2024.ts`), one
  entry per distinct proficiency pick the trait offers, when it says "choose N …". Most traits have
  a single entry; a trait granting two independent picks gets two — e.g. Warforged's Specialized
  Design ("one skill proficiency **and** one tool proficiency of your choice") is two entries: a
  skill choice (`type: "skills"`) and a tool choice (`type: "tools"`). Omit the field if none.
- **language_options** — a single `Choice` when the trait says "choose N language(s)". Omit if none.
- **parent** — for a variant trait that rolls up under a broader one, a ref to the parent
  trait. Two cases: a specific Draconic Ancestry under "Draconic Ancestry"; and a lineage/legacy
  subspecies' benefit trait under the species' "<X> Lineage"/"<X> Legacy" trait (e.g.
  `drow-elven-lineage` → `parent: elf-elven-lineage`). Omit otherwise.
- **trait_specific** — include ONLY the sub-keys the text supports; omit the whole object if none:
  - **damage_type** — a damage-type ref (table below) when the trait keys off one element.
  - **breath_weapon** — the Dragonborn-style structure:
    ```jsonc
    {
      "name": "Breath Weapon",
      "desc": "<rules text>",
      "area_of_effect": { "type": "cone", "size": 15 },   // or { "type": "line", "size": 30 }
      "usage": { "type": "per long rest", "times": 1 },   // free-text type + count
      "dc": { "dc_type": { "index": "dex", "name": "DEX", "url": "/api/2024/ability-scores/dex" }, "success_type": "half" },
      "damage": [{ "damage_type": <ref>, "damage_at_character_level": { "1": "1d10", "5": "2d10", "11": "3d10", "17": "4d10" } }]
    }
    ```
  - **spellcasting** — innate spells the trait grants **outright** (2024 lineage/legacy magic:
    Fiendish Legacy, Elven Lineage, Gnomish Lineage, Light Bearer, Fairy Magic, …). Shape:
    `{ "ability": [<ability refs>], "spells": [{ "spell": <spell ref>, "level": <int> }, …] }`.
    - **ability** — the spellcasting ability the text names. A fixed single ability →
      one-element array (Aasimar Light Bearer: "Charisma is your spellcasting ability" →
      `[CHA]`). A player choice ("Intelligence, Wisdom, or Charisma is your spellcasting
      ability … choose when you select this lineage") → all the listed abilities
      (`[INT, WIS, CHA]`). Use the abbreviated ability refs in the table below.
    - **spells** — one entry per granted spell. `level` is the **character level** the spell is
      gained: a cantrip you "know" is `1`; "Level 3:" / "Starting at 3rd level" → `3`; etc. Look
      up the spell's `index`/`name` in `data/out/5e-SRD-Spells.json` (e.g. "Faerie Fire" →
      `faerie-fire`, "Enlarge/Reduce" → `enlarge-reduce`); url `/api/2024/spells/<index>`.
    - **spells[].swappable_from** — when a granted cantrip may be **replaced from a class list**
      each Long Rest ("you can replace that cantrip with a different cantrip from the Wizard spell
      list"), the class index(es): High Elf → `["wizard"]`, Khoravar → `["cleric","druid","wizard"]`.
      Omit when the spell is fixed.
    - This captures spells the trait simply **grants**. A "choose a cantrip/spell to learn" pick
      with no default is `spell_options` instead (below), not `spellcasting`.
  - **spell_options** / **subtrait_options** — a `Choice` for "choose a cantrip/spell" or
    "choose a lineage/ancestry" traits.
- **url** — `/api/2024/traits/<index>`.

## Exact ability-score references (for spellcasting.ability)

| Ability      | Object                                                                            |
| ------------ | --------------------------------------------------------------------------------- |
| Strength     | `{"index":"str","name":"STR","url":"/api/2024/ability-scores/str"}`               |
| Dexterity    | `{"index":"dex","name":"DEX","url":"/api/2024/ability-scores/dex"}`               |
| Constitution | `{"index":"con","name":"CON","url":"/api/2024/ability-scores/con"}`               |
| Intelligence | `{"index":"int","name":"INT","url":"/api/2024/ability-scores/int"}`               |
| Wisdom       | `{"index":"wis","name":"WIS","url":"/api/2024/ability-scores/wis"}`               |
| Charisma     | `{"index":"cha","name":"CHA","url":"/api/2024/ability-scores/cha"}`               |

## Worked example — innate spellcasting (`drow-elven-lineage`)

Source prose: "Level 1: … you know the Dancing Lights cantrip. Level 3: You always have the
Faerie Fire spell prepared … Level 5: … Darkness … Intelligence, Wisdom, or Charisma is your
spellcasting ability for these spells (choose … when you select this lineage)." →

```json
"trait_specific": {
  "spellcasting": {
    "ability": [
      { "index": "int", "name": "INT", "url": "/api/2024/ability-scores/int" },
      { "index": "wis", "name": "WIS", "url": "/api/2024/ability-scores/wis" },
      { "index": "cha", "name": "CHA", "url": "/api/2024/ability-scores/cha" }
    ],
    "spells": [
      { "spell": { "index": "dancing-lights", "name": "Dancing Lights", "url": "/api/2024/spells/dancing-lights" }, "level": 1 },
      { "spell": { "index": "faerie-fire", "name": "Faerie Fire", "url": "/api/2024/spells/faerie-fire" }, "level": 3 },
      { "spell": { "index": "darkness", "name": "Darkness", "url": "/api/2024/spells/darkness" }, "level": 5 }
    ]
  }
}
```

## Exact damage-type references (for breath weapons / damage_type)

| Type      | Object                                                                              |
| --------- | ----------------------------------------------------------------------------------- |
| Acid      | `{"index":"acid","name":"Acid","url":"/api/2024/damage-types/acid"}`                |
| Cold      | `{"index":"cold","name":"Cold","url":"/api/2024/damage-types/cold"}`                |
| Fire      | `{"index":"fire","name":"Fire","url":"/api/2024/damage-types/fire"}`                |
| Lightning | `{"index":"lightning","name":"Lightning","url":"/api/2024/damage-types/lightning"}` |
| Poison    | `{"index":"poison","name":"Poison","url":"/api/2024/damage-types/poison"}`          |

## Worked example

Found under species `dragonborn`, the "Breath Weapon" trait →
(`data/out/trait/dragonborn-breath-weapon.json`):

```json
{
  "index": "dragonborn-breath-weapon",
  "name": "Breath Weapon",
  "species": [
    {
      "index": "dragonborn",
      "name": "Dragonborn",
      "url": "/api/2024/species/dragonborn"
    }
  ],
  "subspecies": [],
  "desc": [
    "When you take the Attack action on your turn, you can replace one of your attacks with an exhalation of magical energy in either a 15-foot Cone or a 30-foot Line that is 5 feet wide (choose the shape each time)."
  ],
  "trait_specific": {
    "breath_weapon": {
      "name": "Breath Weapon",
      "desc": "Each creature in the area must make a Dexterity saving throw against a DC equal to 8 + your Constitution modifier + your Proficiency Bonus. On a failed save, a creature takes 1d10 damage of the type determined by your Draconic Ancestry; on a success, it takes half as much.",
      "area_of_effect": { "type": "cone", "size": 15 },
      "usage": { "type": "per long rest", "times": 1 },
      "dc": {
        "dc_type": {
          "index": "dex",
          "name": "DEX",
          "url": "/api/2024/ability-scores/dex"
        },
        "success_type": "half"
      },
      "damage": [
        {
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
      ]
    }
  },
  "url": "/api/2024/traits/dragonborn-breath-weapon"
}
```
