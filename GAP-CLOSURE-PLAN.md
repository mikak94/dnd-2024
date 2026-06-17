# Plan — Closing the "Known gaps for a character builder"

Scope: the two gaps documented in [README.md](README.md#known-gaps-for-a-character-builder).
Both are **data-completeness gaps in already-extracted entities** — no new crawling, no new
entity types. We re-run extraction passes that fill fields the schemas already model, then
re-validate and re-assemble.

State confirmed by inspection (2026-06-18):

| Gap | Field                             | Populated | Total                            | Source                               |
| --- | --------------------------------- | --------- | -------------------------------- | ------------------------------------ |
| 1   | `feature.feature_specific`        | **0**     | 483 features                     | feature `desc` prose                 |
| 1   | feat structured choices           | **0**     | 171 feats (~90 mention "choose") | feat `desc` prose                    |
| 2   | `level.spellcasting.spells_known` | **0**     | 160 caster levels                | class-table "Prepared Spells" column |

---

## The hard constraint that shapes everything: referential integrity

[referential-integrity.test.ts](src/pipeline/__tests__/referential-integrity.test.ts) walks
**every** `{ index, url }` object in every assembled `5e-SRD-*.json` — including ones nested
inside `feature_specific` and feat choices — and asserts each resolves to an entity that
exists. So **any option reference we add must point at an entity already in the dataset**, or
the test goes red.

Map of choice targets → where they resolve:

| Choice type               | Option target                     | Resolves against                        | Status                                 |
| ------------------------- | --------------------------------- | --------------------------------------- | -------------------------------------- |
| Fighting Style            | `/api/2024/feats/<style>`         | `5e-SRD-Feats.json`                     | ✅ 10 `fighting-style` feats exist     |
| Expertise                 | `/api/2024/proficiencies/skill-*` | `5e-SRD-Proficiencies.json` (18 skills) | ✅ exist (matches 5e-database's model) |
| Weapon Mastery            | `/api/2024/equipment/<weapon>`    | `5e-SRD-Equipment.json`                 | ✅ weapons exist                       |
| Eldritch Invocations      | per-invocation Feature record     | `5e-SRD-Features.json`                  | ❌ **0 exist** (no `parent` features)  |
| Metamagic                 | per-option Feature record         | `5e-SRD-Features.json`                  | ❌ **0 exist**                         |
| Maneuvers (Battle Master) | per-maneuver record               | `5e-SRD-Features.json`                  | ❌ **0 exist**                         |

This splits Gap 1 into a **well-supported tier** (targets already exist) and an **extension
tier** (targets must be coined first). The plan does the well-supported tier and treats the
extension tier as explicitly optional — see Phase 3.

---

## Gap 2 — `spells_known` (do this first: quick, isolated, lowest risk)

> **STATUS: ✅ DONE.** `level-extraction.md` prompt corrected (Prepared Spells column, all 8
> casters, warlock pact-magic note, ranger/wizard worked examples). Data filled by a **surgical
> deterministic transcription** of the column rather than a subagent re-run (the change is a
> single number, so a script that touches only `spells_known` can't regress already-correct
> feature/slot data; the throwaway script was deleted after the prompt was updated to cover future
> re-extraction). All **160** caster levels now carry `spells_known` (not ~136 — paladin/ranger
> _do_ have a Prepared Spells value at every level). `npm run validate level` → 240 valid, full
> test suite green.

The numbers are already in the source class tables as the **"Prepared Spells"** column
(`data/md/class/{bard,cleric,druid,paladin,ranger,sorcerer,warlock,wizard}.md`). The schema
field [level-2024.ts](src/pipeline/schemas/level-2024.ts) `spellcasting.spells_known` already
exists; only extraction never filled it.

> Note: the field name `spells_known` is a 2014-compat carryover. In 2024 **all** casters
> "prepare" spells, so the source column is labelled "Prepared Spells" for every caster
> (including former known-casters). They map to the same field.

Steps:

1. **Fix the extraction prompt.** [level-extraction.md](src/pipeline/prompts/level-extraction.md)
   line ~88 currently says `spells_known` comes from a "Spells Known" column "for known-casters
   like Sorcerer". Update it to: read from the **"Prepared Spells"** column for all eight
   casters; emit `spells_known` wherever that cell has a number; omit it where the cell is blank
   (e.g. paladin/ranger early levels). Add a worked example using `ranger.md`.
   - Watch the **warlock** table — it is pact-magic-shaped (`Cantrips | Prepared Spells | Spell
Slots | Slot Level`), not per-level slot columns. `spells_known` still comes straight from
     its "Prepared Spells" column.
2. **Re-extract the 160 caster level records.** Dispatch extraction subagents over the 8 caster
   classes (one class per file, per the existing level pass). Because extraction is resumable and
   skips existing files, **delete the 160 caster `data/out/level/*.json` first** (or have the
   subagent overwrite) — otherwise the missing column won't be backfilled. Non-caster classes
   (barbarian/fighter/monk/rogue) are untouched.
3. **Validate + assemble:** `npm run validate level`.
4. **Verify:** `grep -l '"spells_known"' data/out/level/*.json | wc -l` → expect ~136 (160 caster
   levels minus the early paladin/ranger levels with no prepared count; confirm the exact count
   against the tables, don't hard-code an expectation).

No schema change, no integrity-test impact (the value is a number, not a reference).

---

## Gap 1 — `feature_specific` + structured feat choices (the bigger one)

### Phase 1 — Feature option choices (targets that already exist)

> **STATUS: ✅ DONE — via LLM extraction, the pipeline's normal mechanism.** The semantic
> interpretation (which features are choices, the count, the target set, the melee-only filter,
> whether something is _not_ a choice) is done by the **feature-extraction subagent reading each
> feature's prose** — not hard-coded in TS. The durable artifact is an **"Option choices" section
> added to [feature-extraction.md](src/pipeline/prompts/feature-extraction.md)** (referenced from
> [class-feature-extraction.md](src/pipeline/prompts/class-feature-extraction.md)) that carries the
> three patterns + the canonical option tables (10 fighting-style feats / 18 skill proficiencies /
> 38 mastery weapons with melee flags) for the LLM to copy verbatim, so every coined `{index,url}`
> resolves. `feature_specific` is set on **9** features.
>
> _(A first cut used a deterministic generator `feature-options.ts`; scrapped — encoding the prose
> meaning in code is the wrong layer for this pipeline. The generator + its npm script were removed.)_
>
> What the subagent decided from the prose:
>
> - **`assassin-9-infiltration-expertise` excluded** — it's Masterful Mimicry / Roving Aim, not a
>   skill pick. The class-less `weapon-mastery` is also left bare (its prose states no count).
> - **Expertise → proficiencies, not skills** — matching 5e-database's `expertise_options` model
>   (`/api/2024/proficiencies/skill-acrobatics`), choose 2.
> - **Weapon Mastery is prose-counted + class-filtered**: Fighter = all 38 mastery weapons
>   (choose 3), Paladin = all 38 (choose 2), Barbarian = 28 melee-only (choose 2, "Simple or
>   Martial **Melee**").
>
> Guardrails kept: a `feature_specific` ref check in `validate.ts` `checkFeatureRefs` + the
> whole-dataset integrity test. One bug caught this way — the option table first omitted `whip`
> (a melee weapon), so re-running with the corrected table fixed the counts (38/38/28). `npm run
validate feature` → 483 valid; full test suite (incl. referential integrity) green.

Fill [feature-2024.ts](src/pipeline/schemas/feature-2024.ts) `FeatureSpecificSchema` on the
features whose choices point at entities that already resolve. The schema already models all
three shapes (`subfeature_options`, `expertise_options`).

Concrete target features (from `data/out/feature/`):

- **Fighting Style** → `subfeature_options` with `item` refs to the 10 fighting-style feats
  (`archery, blind-fighting, defense, dueling, great-weapon-fighting, interception, protection,
thrown-weapon-fighting, two-weapon-fighting, unarmed-fighting`).
  Features: `fighting-style-fighter`, `fighting-style-paladin`, `fighting-style` (ranger),
  `champion-7-additional-fighting-style`.
- **Expertise** → `expertise_options` with `choose: N` + skill refs (`/api/2024/skills/...`).
  Features: `expertise`, `expertise-bard`, `assassin-9-infiltration-expertise` (and any
  subclass Expertise grants). `choose` = 2 normally.
- **Weapon Mastery** → `subfeature_options` with `item` refs to equipment weapons.
  Features: `weapon-mastery`, `weapon-mastery-fighter`, `weapon-mastery-paladin`,
  `weapon-mastery-barbarian`. `choose` = the per-level count from the class table.

How:

1. **Write a new extraction spec** `src/pipeline/prompts/feature-options-extraction.md` (a
   targeted re-extraction pass, not a rewrite of the whole feature pass). It takes a feature
   file + its source markdown and fills `feature_specific` **only** for the recognized choice
   patterns above, leaving `desc` and everything else intact. It must:
   - Reuse the **exact** option-target slugs (the test resolves them): fighting-style feat
     indexes listed above; skill indexes from `node_modules/5e-database/src/2024/en/5e-SRD-Skills.json`;
     weapon indexes from our assembled `5e-SRD-Equipment.json`.
   - Emit nothing (omit `feature_specific`) when a feature's choice isn't one of the three
     supported shapes — those stay prose for now (tracked in Phase 3).
2. **Dispatch subagents** over the candidate feature files (a curated list — the ~3 dozen
   features matching the three patterns, not all 483). Overwrite in place.
3. **Add a ref check** in [validate.ts](src/pipeline/validate.ts) `checkFeatureRefs`: when
   `feature_specific` is present, validate that fighting-style refs ∈ Feats, expertise skill
   refs ∈ shipped Skills, weapon-mastery refs ∈ Equipment. (Belt-and-suspenders; the integrity
   test is the real gate, but per-record validation gives a better error message.)
4. **Validate + assemble:** `npm run validate feature`.

### Phase 2 — Structured feat choices

> **STATUS: ✅ DONE — via LLM extraction.** Same shape as Phase 1: schema field + prompt rules +
> a subagent that reads each feat's prose and emits the picks.
>
> - **Schema**: added optional `choices: ChoiceSchema[]` to
>   [feat-2024.ts](src/pipeline/schemas/feat-2024.ts) (reusing the recursive `ChoiceSchema`).
> - **Prompt**: an "Option choices" section in
>   [feat-extraction.md](src/pipeline/prompts/feat-extraction.md) — the six patterns (ability
>   score / skill+tool / expertise / damage type / save ability / spell picks), the two `from`
>   shapes (`options_array` of refs; `resource_list` for parameterized spell picks), and the
>   canonical option tables (6 abilities, 5 elemental-adept damage types, 18 skills, 8 Fast-Crafting
>   artisan's tools, 10 instruments).
> - **Scope** (per the agreed answers): **PHB origin + general feats only** — **16** feats got
>   `choices` (Skilled, Magic Initiate, Musician, Crafter, Ability Score Improvement, Charger,
>   Elemental Adept, Fey/Shadow-Touched, Inspiring Leader, Keen Mind, Observant, Resilient, Ritual
>   Caster, Skill Expert, Weapon Master). PHB filtered by each feat md's `Source:` line. **Ability
>   score choices ARE modeled** (only when chooseable, e.g. "an ability of your choice" / "Str or
>   Dex"; a fixed single-ability bump is not a choice). Non-PHB feats (dragonmarks, epic boons,
>   setting feats) intentionally left unpopulated.
> - **Parameterized spell picks** (Magic Initiate "from the Cleric/Druid/Wizard list", Ritual
>   Caster, Fey/Shadow-Touched) use `resource_list` with a `resource_list_url` string + the
>   school/level filter in `desc` — `resource_list_url` is a plain string, not an `{index,url}`
>   pair, so the integrity walker never flags it. The enumerable picks (abilities, damage types,
>   skills, tools, class refs) all resolve.
> - **Guardrail**: a `choices` ref check added to `validate.ts` `checkFeatRefs`. `npm run validate
feat` → 171 valid; independent check → 168 enumerated option refs, 0 unresolved; full test
>   suite (incl. referential integrity) green.

[feat-2024.ts](src/pipeline/schemas/feat-2024.ts) has no choices field — only `desc`. ~90 feats
embed picks (Magic Initiate, Skilled, Skill Expert, Lucky-style, Elemental Adept, etc.).

1. **Extend the schema.** Add an optional `choices` (or `feat_specific`) field to `FeatSchema`.
   **Reuse the existing recursive `ChoiceSchema` from
   [common-2024.ts](src/pipeline/schemas/common-2024.ts)** (line 122) rather than inventing a new
   shape — it already models `choose` / `from` / nested option sets the way 5e-database does, and
   the integrity walker already understands it.
2. **Update** [feat-extraction.md](src/pipeline/prompts/feat-extraction.md) with rules + a worked
   example (Skilled = choose 3 from skills/tools; Magic Initiate = pick a spell list + cantrips +
   a level-1 spell). Targets must resolve: skills → SRD Skills, tools/proficiencies → our
   Proficiencies set, spells → our Spells set.
   - Parameterized picks ("two cantrips from the Wizard spell list") that can't be enumerated as
     fixed refs should use `option_set_type: "resource_list"` style (point at a list URL) **or**
     stay descriptive — decide per case so we never emit a dangling `{index,url}`.
3. **Re-extract the choice-bearing feats** (delete/overwrite the affected `data/out/feat/*.json`).
4. **Validate + assemble:** `npm run validate feat`.

### Phase 3 — Invocations / Metamagic / Maneuvers as entities

> **STATUS: ✅ DONE.** Each pick is now its own `parent`-linked Feature record, and the parent
> feature lists them in `feature_specific`. **58 new option records**: 28 Eldritch Invocations,
> 10 Metamagic, 20 Battle Master Maneuvers (features 483 → 541).
>
> **The twist found mid-flight:** the invocation/metamagic option lists **were never crawled** —
> the class pages link them out to separate wiki pages (`/warlock:eldritch-invocation`,
> `/sorcerer:metamagic`) rather than embedding them. So this wasn't just "coin entities from
> existing prose"; it needed new **stage-1/2** work: two single-page crawl categories added to
> `config.ts` (`invocations`, `metamagic`, reusing the poison single-page branch in `crawl.ts`),
> then crawl + convert. Maneuvers were already present in the Battle Master subclass page.
>
> - **Prompt**: a "Parent-linked option records" section in `feature-extraction.md` — index/name
>   conventions (`eldritch-invocation-<slug>` / `metamagic-<slug>` / `maneuver-<slug>`), the
>   `level` rule (invocation prereq level else 1; metamagic 2; maneuver 3), prerequisite parsing
>   ("Level N+ Warlock" → level; "X Invocation" → feature ref), and how to wire each parent.
> - **Parents wired**: `eldritch-invocations` → `feature_specific.invocations[]` (flat catalog;
>   the per-level count stays on `class_specific.invocations_known`); `metamagic` →
>   `subfeature_options` (choose 2); `battle-master-3-combat-superiority` → `subfeature_options`
>   (choose 3). Matches 5e-database's 2014 shapes (invocations flat array, metamagic subfeature_options).
> - **Data**: three LLM subagents (one per source) read the prose and emitted the records + wiring.
> - **Verify**: `npm run validate feature` → 541 valid; independent check → 58 parent refs + 58
>   option records (class/subclass/parent) all resolve, 6 invocation feature-prereqs resolve; full
>   test suite (incl. referential integrity) green.

---

## Validation & test gate (run after each gap)

```sh
npm run validate level      # gap 2
npm run validate feature    # gap 1 / phase 1
npm run validate feat       # gap 1 / phase 2
npm run test                # vitest: referential-integrity + per-category tests
npm run format:check
```

The whole-dataset integrity test is the acceptance gate for Gap 1 — if every added option
reference resolves, it stays green; a dangling ref shows up as
`features:<idx> -> feats/<bad>` etc.

---

## Suggested sequencing

1. **Gap 2** end-to-end (prompt fix → re-extract → validate → test). Smallest, isolated, builds
   confidence in the loop. ~½ day.
2. **Gap 1 Phase 1** (feature options for the three supported types + validate.ts ref check). ~1 day.
3. **Gap 1 Phase 2** (feat schema + choices + re-extract). ~1 day.
4. Update [README.md](README.md): move the closed items out of "Known gaps", record the residual
   (Phase 3 prose-only invocations/metamagic/maneuvers) under "Next steps".

## Risks / watch-items

- **Resumability hides backfills.** Extraction skips existing files; re-extraction passes must
  delete or overwrite the target JSON, or the new fields silently won't appear.
- **Slug drift = red test.** Option refs must use the canonical target slugs exactly (apostrophes,
  `cartographers-tools`-style normalizations). Verify against the assembled sets, not from memory.
- **Warlock pact-magic table** shape differs — handle explicitly in the level prompt.
- **Parameterized feat/feature picks** ("from the Wizard spell list") can't always be a fixed ref
  set; never emit a `{index,url}` that won't resolve — use a list-type option or keep prose.
- **`expertise_options.from.options` is `z.array(z.unknown())`** — the schema won't enforce shape,
  so the integrity test is the only guard; keep the option items as real skill APIReferences.

---

## Open follow-ups — data quality (found 2026-06-20 while structuring class starting equipment)

Both surfaced when class `starting_equipment_options` were converted from prose `desc` to structured
`options_array` (see [src/pipeline/prompts/class-extraction.md](src/pipeline/prompts/class-extraction.md)

- [src/pipeline/schemas/class-2024.ts](src/pipeline/schemas/class-2024.ts), which now reuses the shared
  `ChoiceSchema`). The class refs were pointed at the _canonical_ targets below; these clean up the targets.

* **`arrow` vs `arrows` — two representations to reconcile (NOT a plain duplicate).** They are
  different things, so do not blindly merge/delete:
  - `arrows.json` = the catalog item from the equipment table
    ([weapon.md L109](data/md/equipment/weapon.md): `| Arrows | 20 | Quiver | 1 lb. | 1 GP |`) —
    a **bundle of 20**, cost 1 GP, weight 1 lb, desc "20 Arrows; stored in a Quiver." Referenced by
    **nothing**.
  - `arrow.json` = a bare **single-unit** stub (no cost/weight/desc); it's the ammunition type bows
    name (`Ammunition (… Arrow)`) and the unit used in starting equipment.
  - **All "20 arrows" refs use `counted_reference(count: 20, of: arrow)`** — 3 classes (fighter,
    ranger, rogue) **and 4 pre-existing backgrounds** (soldier, guide, emerald-enclave-caretaker,
    house-deneith-heir). So the class refs are consistent with the existing dataset + 5e-bits, which
    also models it as `arrow` ×20. Leaving as-is is defensible.
  - **Decision for the owner (not an obvious fix):** either (A) keep both — `arrow` as the ×N unit,
    `arrows` as the catalog 20-pack — and optionally give `arrow` a per-unit cost/weight so it isn't a
    bare stub; or (B) standardize starting equipment to reference `arrows` ×1 and drop `arrow`
    (repoint all 7 refs, re-validate). Same question applies to other ammunition (bolts, etc.) if present.
  - **Note:** the dup guard in `validate.ts` keys on identical `index` OR `name`, so it would not flag
    these anyway ("Arrow" ≠ "Arrows"); they are intentionally distinct.

* **Wizard "Spellbook" in starting equipment — RESOLVED (2026-06-20).** The 2024 Spellbook is a
  Wizard **class feature** (3 lb, 100 pages, no GP cost), not catalog gear — the equipment table only
  lists "Locking Spellbook" (35 GP). A from-scratch equipment crawl therefore never yields a plain
  `spellbook`, so a hand-authored `data/out/equipment/spellbook.json` (briefly added, with a wrong 2014
  50 GP price) was **non-reproducible** and has been **removed**.
  - **Fix:** the Wizard bundle now lists the Spellbook as `{ "option_type": "string", "string":
"Spellbook" }` instead of a `counted_reference`, so there's no equipment ref to resolve, and
    `equipmentOptionLabel` renders string options. The class-extraction prompt documents this as a
    **single named exception** (the Wizard's Spellbook), NOT a "check the catalog" rule — deliberately,
    so class extraction needs no access to the equipment dataset and the pipeline's current
    extract order (equipment is built after classes) does not have to change. Reproducible from
    scratch; the Spellbook's stats still live on the Wizard's feature record.
  - **Prompt verified by real extraction (2026-06-20).** Independent Sonnet re-extractions of wizard,
    fighter, and cleric (spec + source only, not the committed output) reproduced
    `starting_equipment_options` (incl. the Spellbook string exception), `multi_classing`, and
    `spellcasting` — semantically identical (only cosmetic JSON key/array ordering differs).

* **Class `multi_classing` made source-derived — DONE (2026-06-20).** Prereqs/proficiencies are NOT
  on the class pages as a table; the shared rules page (`/class:multiclassing`) gives the general rule
  ("13 in the new class's **primary ability**"; proficiencies "as detailed in each class's
  description"). So: crawl that page (new `multiclassing` single-page source in `config.ts` →
  `data/md/multiclassing/multiclassing.md`; it has no schema/`data/out` of its own), and the
  class-extraction prompt now derives `multi_classing` from the class page — prereq from the **Primary
  Ability** row (single → `prerequisites`; "X and Y" → two entries; "X or Y" → `prerequisite_options`
  choose 1), proficiencies from the **"As a Multiclass Character"** section. Fixed a real bug: Fighter
  had a flat `prerequisites: [STR 13]` that nullified its STR-or-DEX choice; now `prerequisite_options`
  only. The crawled page also documents the multiclass spell-slot table (engine `MULTICLASS_SLOTS`).

* **Class `spellcasting.info` dropped — DONE (2026-06-20).** `spellcasting` is now just
  `{ level, spellcasting_ability }` (both deterministic). The `info` prose array was removed from the
  schema, the 8 casters, and the prompt: it was unused by the builder, duplicated the class's own
  "Spellcasting" feature record, and its free text wasn't reproducible across extractions.

* **Full 12-class re-extraction verified (2026-06-20).** Independent Sonnet re-extractions of all 12
  classes confirmed `spellcasting` and `multi_classing` (prereqs incl. Fighter's OR; proficiency
  indexes; "skill of your choice" omitted) reproduce. **Accepted, deliberately NOT fixed:** class
  proficiency-ref **names** are lowercase ("Light armor") while `5e-SRD-Proficiencies.json` is title
  case ("Light Armor") — ~50 refs across all classes (main `proficiencies` + `multi_classing`). Only
  the `index` matters (it resolves; tests pass); the casing is cosmetic. We chose not to normalize and
  not to bake a proficiency-name list into the prompt (brittle). So a from-scratch re-extraction will
  show cosmetic name-casing diffs in proficiency refs — that is expected, not a regression.

  - **Latent (pre-existing, not introduced here):** class/background equipment refs are slugified
    names that resolve only because `slugify(name)` happens to equal the equipment index; per-category
    `validate` does not check equipment refs, so the only gate is the final referential-integrity
    test. Fine today, but a fail-fast equipment-ref check in `checkClassRefs`/`checkBackgroundRefs`
    (would require building equipment first) is the real ordering fix if it ever matters.
