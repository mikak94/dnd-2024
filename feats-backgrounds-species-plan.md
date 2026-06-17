# Plan: Add Feats, Backgrounds, and Species (+ Subspecies, Traits) to the D&D 2024 pipeline

## Context

The pipeline already builds 2014-compatible `/api/2024/...` JSON for spells, classes,
subclasses, features, and levels (all complete). The next gap to fill is **character
creation**: feats, backgrounds, and species.

**Data source (resolved with the user): all five categories are rebuilt from the wiki via
crawl + Opus.** The shipped `5e-database` 2024 data is a sparse SRD subset — real record
counts in `node_modules/5e-database/src/2024/en/` are feats **17**, backgrounds **4** (only
acolyte/criminal/sage/soldier; the PHB has 16), species **9** (missing Aasimar; PHB has 10),
subspecies **24**, traits **67** — far short of the full PHB, so transforming it would _drop
most PHB content_ (e.g. 12 of 16 backgrounds). It does ship authoritative zod schemas under
`node_modules/5e-database/src/2024/schemas/` (useful as a field-shape reference), but the data
itself is too thin to reuse. So, like spells, we rebuild the full PHB set from the wiki.

Unlike spells, the 2024 rules **restructured** these types, so a strict 2014 schema
can't represent them. Per decisions taken with the user:

- **Schema style:** stay **as close to the 2014 schema as possible**, diverging only where
  2024 logic genuinely doesn't fit. Keep 2014 _field names_ (`starting_proficiencies`,
  `starting_equipment_options`, `trait_specific`, `parent`, …), `desc[]` arrays, local
  `APIReference` `{index,name,url}`, `Choice`/`option_set` structures, `/api/2024/...`
  URLs, and Traits as **separate** entities. Where 2014 used `races`/`subraces`/`racial_traits`
  we rename to `species`/`subspecies`/`traits` (the 2024 naming the user chose).
- **Drop the 2014 fields 2024 deleted:** background `feature`/`personality_traits`/
  `ideals`/`bonds`/`flaws`/`language_options` (2024 backgrounds grant no languages); species
  `ability_bonuses`/`ability_bonus_options`/`alignment`/`languages`/`language_desc`/
  `language_options` (ASIs moved to backgrounds, languages to Origin); subspecies
  `ability_bonuses`.
- **Add the forced 2024-only fields:** feat `type`; background `ability_scores[]` + granted
  `feat`; species `type` (creature type) + `size_options` (size choice).
- **Resolved schema forks (with the user):** (1) feat prerequisites → **tagged union with a
  `type` discriminant** (level / ability_score / proficiency / feat / other); (2) background
  equipment → **single `starting_equipment_options` Choice** with gold as a `money` option
  inside it, **no standalone `starting_gold`**; (3) species → **drop removed fields, keep
  neutral flavor** (`age?`, `size_description?`); (4) traits → **keep the full 2014
  `TraitSchema` verbatim** (incl. detailed `breath_weapon`), renamed only.
- **Species modeling:** three normalized entity types — Species, Subspecies, Traits.
- **Feat scope:** all PHB feat types — `origin`, `general`, `fighting-style`, `epic-boon`.

This adds **5 new entity categories** (feat, background, species, subspecies, trait),
each following the existing add-a-category pattern: a `CATEGORIES`/crawl entry, a zod
schema in `src/pipeline/schemas/`, a `REGISTRY` + `checkRefs` entry in `validate.ts`, and
an extraction prompt in `src/pipeline/prompts/`. Stage 2 (convert) is already generic.

## New entity schemas (`src/pipeline/schemas/*.ts`)

Each schema redeclares `APIReferenceSchema` locally (project convention — avoids mixing
zod versions), uses `z.strictObject`, imports `zod/v4`, exports `XSchema` + `type X`, and
ends every entity with `url: "/api/2024/<plural>/<index>"`. For `ChoiceSchema`, redeclare a
local copy mirroring the shared 2014/2024 `Choice` in
[common.ts](node_modules/5e-database/src/schemas/common.ts) — the recursive
`{ desc?, choose, type?, from: { option_set_type, options[] } }` with the full set of
`option_type` variants (`reference`, `multiple`, `money`, `counted_reference`,
`ability_bonus`, `breath`, …). **Do not** reuse `feature-2024.ts`'s `subfeature_options`
shape — it only models `{ option_type, item }` and cannot express the `money`/`multiple`
branches the background equipment choice and trait/feat options need.

**feat-2024.ts** — `FeatSchema`

```
index, name,
type: z.enum(["origin","general","fighting-style","epic-boon"]),   // 2024-only
prerequisites: z.array(FeatPrerequisiteSchema),                     // [] if none
desc: z.array(z.string()),                                          // 2024 `description` split into paragraphs
url                                                                 // /api/2024/feats/<index>
```

`FeatPrerequisiteSchema` (2014 ability-gate generalized for 2024): strictObject with
`type: z.enum(["level","ability_score","proficiency","feat","spellcasting","other"])`,
plus optional `level`, `ability_score: APIReferenceSchema`, `minimum_score`,
`proficiency: APIReferenceSchema`, `feat: APIReferenceSchema`, `desc`.

**background-2024.ts** — `BackgroundSchema` (2014 base; 2024 cut ideals/bonds/flaws/feature/languages)

```
index, name,
starting_proficiencies: z.array(APIReferenceSchema),   // 2014 name; 2024 skills+tools
ability_scores: z.array(APIReferenceSchema),           // 2024-only: the 3 ASI options
feat: APIReferenceSchema,                              // 2024-only: granted origin feat
                                                       //   (shipped 2024 ref carries an optional `note`
                                                       //   e.g. "Cleric"; fold into name or add `note?`)
starting_equipment_options: z.array(ChoiceSchema).optional(),  // 2024 "bundle A or gold B":
                                                       //   ONE Choice (choose 1) whose options are the
                                                       //   item bundle (option_type "multiple") and the
                                                       //   gold (option_type "money", {count, unit})
desc: z.array(z.string()).optional(),                  // flavor; 2014 had none, replaces dropped `feature`
url
```

**Decision (resolved):** model equipment as the single `starting_equipment_options` Choice
above — gold is a `money` branch inside it, so **drop standalone `starting_gold`** and the
fixed `starting_equipment[]` (2024 has no fixed grant outside the choice). Omit 2014
`personality_traits`/`ideals`/`bonds`/`flaws`/`feature`/`language_options` entirely (not in 2024).

**species-2024.ts** — `SpeciesSchema` (2014 race base; ASIs/alignment/languages dropped in 2024)

```
index, name,
size: z.string().optional(),               // present unless size is a choice
size_options: ChoiceSchema.optional(),     // 2024: "Small or Medium" choice (invariant: exactly
                                           //   one of size / size_options is present)
size_description: z.string().optional(),   // 2014 flavor; keep when present
speed: z.number(),
type: z.string(),                          // 2024-only, e.g. "Humanoid" (creature type, required)
age: z.string().optional(),                // 2014 flavor; keep when present
traits: z.array(APIReferenceSchema),       // refs to separate Trait entities
subspecies: z.array(APIReferenceSchema),   // 2014 "subraces" -> "subspecies"
url                                        // /api/2024/species/<index>
```

**Decision (resolved):** drop the 2014 fields 2024 removed — `ability_bonuses`/
`ability_bonus_options` (moved to backgrounds), `alignment`, `languages`/`language_desc`/
`language_options` (now Origin), and the species-level `starting_proficiencies` (granted via
traits in 2024). Keep neutral flavor (`age`, `size_description`); add `type` + `size_options`.

**subspecies-2024.ts** — `SubspeciesSchema` (2014 subrace base)

```
index, name,
species: APIReferenceSchema,               // 2014 "race" -> "species"
desc: z.array(z.string()),                 // 2014 subrace used a bare string; normalized to string[]
traits: z.array(APIReferenceSchema),       // 2014 "racial_traits" -> "traits"
url                                        // /api/2024/subspecies/<index>
```

**Decision (resolved):** drop 2014 `ability_bonuses` (ASIs moved to backgrounds in 2024).

**trait-2024.ts** — `TraitSchema` (2014 trait base, incl. parent + trait_specific)

```
index, name,
species: z.array(APIReferenceSchema),      // 2014 "races" -> "species"
subspecies: z.array(APIReferenceSchema),   // 2014 "subraces" -> "subspecies"
desc: z.array(z.string()),
proficiencies: z.array(APIReferenceSchema).optional(),   // optional in 2014
proficiency_choices: ChoiceSchema.optional(),
language_options: ChoiceSchema.optional(),
parent: APIReferenceSchema.optional(),     // e.g. Draconic Ancestry (Black) -> Draconic Ancestry
trait_specific: TraitSpecificSchema.optional(),  // damage_type, breath_weapon, subtrait_options, spell_options
url                                        // /api/2024/traits/<index>
```

## Config (`src/pipeline/config.ts`)

Add **three** listing categories to `CATEGORIES` — feats, backgrounds, species:

```
feats:       { name: "feat",       listing: "/feats",       prefix: "feat" }
backgrounds: { name: "background", listing: "/backgrounds", prefix: "background" }
species:     { name: "species",    listing: "/species",     prefix: "species" }
```

**No `CATEGORIES` entry for subspecies (or traits).** _(Resolved during step 1: subspecies are
**not** separate wiki pages — each species page embeds them inline, e.g. Elf's "Elven
Lineages". See Open items.)_ So subspecies follow the **trait model**: never crawled or
converted, emitted straight into `data/out/subspecies/` by the species extraction pass. Neither
appears in `CATEGORIES`, so `npm run crawl subspecies` / `npm run convert subspecies` correctly
report "Unknown category" — there is nothing to crawl. They are still registered in `validate.ts`
`REGISTRY` so `npm run validate subspecies` / `... trait` assemble the records.

## Crawl (`src/pipeline/crawl.ts`)

- **feats, backgrounds, species** use the existing generic `crawl(cat)` (listing +
  `extractSlugs`) — no new code beyond the config entries and the CLI dispatch falling
  through to the generic branch.
- **subspecies**: no crawl — embedded in species pages, extracted from the species markdown in
  the species pass (same model as traits). _(Earlier drafts planned a `crawlSubspecies()`
  modeled on `crawlSubclasses()`; dropped once step 1 confirmed there are no subspecies pages.)_
- **traits**: no crawl — extracted from species markdown (same model as
  features-from-subclass-markdown).

## Validate (`src/pipeline/validate.ts`)

- Import the 5 new schemas/types; extend the `Entity` union
  ([validate.ts:37](src/pipeline/validate.ts#L37)).
- Add ability-score / proficiency reference sets for ref checks. **(Resolved differently than
  first drafted:** proficiencies are validated against **our own authoritative
  `data/out/5e-SRD-Proficiencies.json`**, not the sparse shipped set — see the Proficiencies
  addendum below. The originally-planned `SHIPPED_LANGUAGES` / `SHIPPED_EQUIPMENT` sets turned
  out unused and were dropped.)
- Add `checkFeatRefs`, `checkBackgroundRefs`, `checkSpeciesRefs`, `checkSubspeciesRefs`,
  `checkTraitRefs` mirroring [checkSpellRefs](src/pipeline/validate.ts#L46-L70): each
  enforces `url === /api/2024/<plural>/<index>`, and validates APIReference `index`es
  against the relevant SHIPPED set (ability-scores for feat/background ASIs, proficiencies
  for background/trait proficiencies, equipment for background equipment, etc.).
- **Warning, not error, for out-of-SRD refs.** `validateOne` excludes any record with an
  `error` from the assembled output ([validate.ts:237-247](src/pipeline/validate.ts#L237-L247)),
  so full-PHB content referencing proficiencies/equipment outside the sparse SRD subset must
  emit **warnings** (like the existing artificer-class case) — otherwise valid records get
  silently dropped. Reserve hard `errors` for url/index-format mismatches. Cross-refs to our
  _own_ new categories (background→feat, species→trait/subspecies) are format-checked only.
- Register all 5 in `REGISTRY` ([validate.ts:136-177](src/pipeline/validate.ts#L136-L177)):
  `feat`→`5e-SRD-Feats.json`, `background`→`5e-SRD-Backgrounds.json`,
  `species`→`5e-SRD-Species.json`, `subspecies`→`5e-SRD-Subspecies.json`,
  `trait`→`5e-SRD-Traits.json`. CLI auto-discovers via `REGISTRY[catKey]`.

## Extraction prompts (`src/pipeline/prompts/*.md`)

One spec per category, following the structure of
[subclass-extraction.md](src/pipeline/prompts/subclass-extraction.md): title + schema
ref + "How a subagent runs a batch" + input layout + output shape + per-field rules +
exact reference tables (hard-coded `APIReference` objects for ability-scores, the 12
classes, etc.) + a worked example. All use **Opus**.

- `feat-extraction.md` — 1 feat/file from `data/md/feat/`. Split the prose into `desc[]`
  paragraphs; classify `type`; parse "Prerequisite:" lines into `prerequisites[]`.
- `background-extraction.md` — 1 background/file from `data/md/background/`. Map the granted
  feat + 3 ability scores + skill/tool proficiencies + "Equipment: Choose A or B" into
  `starting_equipment_options` (gold as the `money` branch).
- `species-extraction.md` (applies the shared `subspecies-extraction.md` + `trait-extraction.md`
  rules) — from each `data/md/species/*.md`, **one agent in one pass** emits the 1 Species
  record **and** its embedded Subspecies records **and** all their Trait records, writing the
  Species to `data/out/species/`, each Subspecies to `data/out/subspecies/`, and each Trait to
  `data/out/trait/`. Because the same agent computes each child slug once and reuses it for the
  `Species.subspecies[]` / `Species.traits[]` ref, refs and records cannot diverge.
- `subspecies-extraction.md` is a **shared sub-spec** (per-Subspecies field rules) applied
  _within_ the species pass, **not** run as a standalone category. Subspecies have no separate
  pages — they're embedded in the species page (e.g. Elf's "Elven Lineages"), so the parent
  species index comes from the page being extracted, not from a filename.
- `trait-extraction.md` is a **shared sub-spec** (per-Trait field rules + reference tables)
  applied _within_ the species pass, **not** run as a standalone category — this is what
  eliminates the cross-agent slug-mismatch risk the earlier draft had.

**Deterministic slug rule** (so cross-refs resolve before targets exist _and_ refs match
records): feat `<feat-name>`; background `<bg-name>`; species `<species-name>`; subspecies
`<subspecies-name>`; trait `slugify("<parent-species-or-subspecies-index>-<trait-name>")`.
Define `slugify` once (lowercase; spaces/punctuation → `-`; collapse repeats) and restate it
verbatim in every prompt. The species pass derives each subspecies/trait slug from that one
function and emits both the parent's `subspecies[]`/`traits[]` ref and the child record from
the single value.

**Extraction order (cross-entity refs):** feats → backgrounds (ref feats) → species (emits
species **and** their subspecies **and** all their traits, in one pass). There is no separate
"subspecies" or "traits" pass — both are produced alongside their parent species.

## Tests (`src/pipeline/__tests__/*.test.ts`)

Add one test per category mirroring
[spells.test.ts](src/pipeline/__tests__/spells.test.ts): load each assembled
`5e-SRD-*.json`, `safeParse` every record against its schema, and assert `index`
uniqueness. Add targeted cases: feat `type` ∈ the enum; background `feat`/`ability_scores`
present; trait `parent`/`trait_specific` shapes; species `traits[]`/`subspecies[]` refs
resolve to emitted indexes.

## README (`README.md`)

Extend the status table and the prompt/layout sections with the 5 new categories once
data lands.

## Files to create / modify

| File                                                                            | Change                                                                                                         |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/pipeline/config.ts`                                                        | + `feats`/`backgrounds`/`species` listing entries (no subspecies/trait entry — both embedded in species pages) |
| `src/pipeline/crawl.ts`                                                         | no change (subspecies aren't crawled — embedded in species pages)                                              |
| `src/pipeline/validate.ts`                                                      | + 5 schema imports, Entity union, 3 SHIPPED sets, 5 `checkXRefs`, 5 REGISTRY entries                           |
| `src/pipeline/schemas/feat-2024.ts`                                             | NEW                                                                                                            |
| `src/pipeline/schemas/background-2024.ts`                                       | NEW                                                                                                            |
| `src/pipeline/schemas/species-2024.ts`                                          | NEW                                                                                                            |
| `src/pipeline/schemas/subspecies-2024.ts`                                       | NEW                                                                                                            |
| `src/pipeline/schemas/trait-2024.ts`                                            | NEW                                                                                                            |
| `src/pipeline/prompts/{feat,background,species,subspecies,trait}-extraction.md` | NEW (5)                                                                                                        |
| `src/pipeline/__tests__/{feats,backgrounds,species,subspecies,traits}.test.ts`  | NEW (5)                                                                                                        |
| `README.md`                                                                     | status table + sections                                                                                        |

## Verification

```sh
# 1. Crawl (confirm listing/prefix first — see Open items)
npm run crawl feats && npm run crawl backgrounds && npm run crawl species
#    (no subspecies crawl — they're embedded in species pages)

# 2. Convert (generic, no code change)
npm run convert feats && npm run convert backgrounds && npm run convert species
#    (no subspecies convert — embedded in species pages)

# 3. Extract via Opus subagents, IN ORDER (~10 files/agent):
#    feats -> backgrounds -> species (emits species + subspecies + traits, one pass)
#    (subspecies and traits are emitted within the species pass, not separate runs)

# 4. Validate + assemble (order matters for ref checks)
npm run validate feat && npm run validate background
npm run validate species && npm run validate subspecies && npm run validate trait

# 5. Test suite
npm test
```

Success = each `npm run validate` reports 0 errors and writes a sorted
`data/out/5e-SRD-*.json`; `npm test` green; spot-check that a 2024 background lists its
granted feat + 3 ability scores, a feat carries a valid `type`, and a species' `traits[]`
resolve to emitted Trait records.

## Open items to confirm during step 1 (cheap, one fetch each)

- Exact wiki **listing path + namespace prefix** for feats / backgrounds / species
  (defaults assumed `/feats`+`feat`, `/backgrounds`+`background`, `/species`+`species`).
- ~~Whether **subspecies are separate wiki pages** or embedded inline in species pages.~~
  **RESOLVED: embedded inline** (e.g. Elf's "Elven Lineages"). No subspecies crawl/convert/
  `CATEGORIES` entry; species + subspecies + traits are all extracted from the single species
  `.md` in one pass (the trait model). Subspecies stay a separate entity in the schema/output.
- Whether the wiki still labels them "races" rather than "species" (adjust prefix only;
  output naming stays `species`/`subspecies` per the chosen 2024 convention).

## Addendum: Proficiencies as a first-class category (resolved post-implementation)

Validating background/feat/trait proficiency refs against the **shipped** sparse 2024
proficiencies emitted 45 warnings — almost all because our extraction used a `tool-<trade>`
index convention while 5e-database names artisan tools/kits/instruments bare
(`smiths-tools`, `disguise-kit`, `lute`) and only a few `tool-`-prefixed
(`tool-thieves-tools`, `tool-calligraphers-supplies`); plus 3 umbrella categories
(`gaming-set`, `musical-instrument`, `artisans-tools`) the shipped set lacks. Decisions
(with the user): **match 5e-database naming**, and ship proficiencies as a **first-class
emitted category**.

- **Schema:** `src/pipeline/schemas/proficiency-2024.ts` — `{ index, name, type, reference?, url }`.
- **Generation (not crawled):** `src/pipeline/proficiencies.ts` (`npm run proficiencies`) derives
  per-entity JSON into `data/out/proficiency/` from the canonical 5e-database 2024 list (indexes
  verbatim, `url` normalized to `/api/2024/proficiencies/<index>`) + the 3 PHB category
  proficiencies. Authoritative **and** independent of our own content, so the check still catches
  typos — not a tautology.
- **Validate:** `proficiency` REGISTRY entry + `checkProficiencyRefs`; `validate.ts` loads the
  proficiency ref-set from our assembled `5e-SRD-Proficiencies.json` (falling back to the shipped
  file only until it's built). Build proficiencies **before** validating backgrounds/feats/traits.
- **Existing data:** the 45 offending background refs were normalized in place to the canonical
  indexes; the background/trait extraction prompts were updated to use 5e-database naming + a
  reference table. Result: 0 errors, **0 warnings** across all categories.
