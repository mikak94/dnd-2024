# Plan: Add Subclasses Extraction to D&D 2024 Pipeline

## Context

The pipeline successfully extracts 419 spells. User wants to scale it up to subclasses.

**What 5e-database 2024 already has:**

- 12 Classes (PHB only)
- 231 Class Features (complete for PHB classes)
- 12 Subclasses (one per PHB class - SRD basics only)

**What we need:**

- ~48 subclasses: full set for 12 PHB classes
- ~200+ features: class features + subclass features
- ~240 levels: 20 levels × 12 classes (with class_specific data)

**Key insight:** 2024 schema is simpler than 2014 - subclass features are embedded directly in the subclass record (`features[]`), not in a separate Features file.

## 2014 Schema Structure (what we'll use)

**Subclass:**

```typescript
{ index, name, class, subclass_flavor, desc[], subclass_levels, spells[]?, url }
```

- `subclass_levels`: URL like `/api/2024/subclasses/berserker/levels`
- Features referenced, not embedded

**Feature:**

```typescript
{ index, name, level, class, subclass?, desc[], prerequisites[], url }
```

- Separate entity for each feature
- Can belong to class OR subclass

**Level:**

```typescript
{ index, level, prof_bonus, ability_score_bonuses, features[], class, class_specific?,
  subclass?, subclass_specific?, spellcasting?, url }
```

- Per-level progression with class-specific values (rage_count, ki_points, etc.)
- References Features by URL

## Implementation Steps

### Phase 1: Extend Config (config.ts)

Add subclass discovery config:

```typescript
export const CLASS_NAMES = [
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'fighter',
  'monk',
  'paladin',
  'ranger',
  'rogue',
  'sorcerer',
  'warlock',
  'wizard',
] as const;

// Pages that are NOT subclasses (but are still Features per 2014 schema)
const CLASS_AUXILIARY =
  /^(main|spell-list|fighting-style|maneuvers|pact-boon)$/;

// Subclass flavor text per class
export const SUBCLASS_FLAVOR: Record<string, string> = {
  barbarian: 'Primal Path',
  bard: 'Bard College',
  cleric: 'Divine Domain',
  druid: 'Druid Circle',
  fighter: 'Martial Archetype',
  monk: 'Monastic Tradition',
  paladin: 'Sacred Oath',
  ranger: 'Ranger Archetype',
  rogue: 'Roguish Archetype',
  sorcerer: 'Sorcerous Origin',
  warlock: 'Otherworldly Patron',
  wizard: 'Arcane Tradition',
};

export const CRAWL_DELAY_MS = 500; // Rate limiting
```

Add `classes` and `subclasses` to CATEGORIES:

- `classes`: fetch `/<class>:main` for all 12 classes (for level tables and comparison)
- `subclasses`: discover from all 12 class namespaces

**Note:** Eldritch Invocations and Metamagic are NOT filtered - they are Features per 2014 schema, extracted with `parent` references to their main feature.

### Phase 2: Update Crawler (crawl.ts)

Add namespace-based crawl with rate limiting (500ms between requests to avoid wiki blocks):

**For classes (all 12):**

1. Fetch `/<class>:main` for each class
2. Save as `data/raw/class/<class>.html`
3. These pages contain level progression tables needed for Level entities

**For subclasses (all 12 classes):**

1. For each class in CLASS_NAMES
2. Fetch the class main page to discover subclass links
3. Filter out auxiliary pages (spell-list, metamagic, etc.)
4. Fetch each subclass page
5. Save as `data/raw/subclass/<class>--<subclass-slug>.html`

The double-hyphen preserves parent class context for extraction.

**Rate limiting:**

```typescript
const CRAWL_DELAY_MS = 500; // Be polite to the wiki
await sleep(CRAWL_DELAY_MS);
```

### Phase 3: Schemas (match 2014 structure)

**subclass-2024.ts** - 2014-style with level reference:

```typescript
export const SubclassSchema = z.strictObject({
  index: z.string(),
  class: APIReferenceSchema,
  name: z.string(),
  subclass_flavor: z.string(), // e.g., "Primal Path", "Bard College"
  desc: z.array(z.string()),
  subclass_levels: z.string(), // URL: /api/2024/subclasses/<index>/levels
  spells: z.array(SubclassSpellSchema).optional(),
  url: z.string(),
});
```

**feature-2024.ts** - Separate feature entities:

```typescript
export const FeatureSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  level: z.number(),
  class: APIReferenceSchema.optional(),
  subclass: APIReferenceSchema.optional(),
  parent: APIReferenceSchema.optional(), // For invocations/metamagic linking to main feature
  desc: z.array(z.string()),
  prerequisites: z.array(FeaturePrerequisiteSchema),
  feature_specific: FeatureSpecificSchema.optional(), // For subfeature_options, invocations, etc.
  url: z.string(),
});
```

**level-2024.ts** - Level progression with class_specific:

```typescript
// Per-class specific fields - use discriminated union
export const BarbarianSpecificSchema = z.strictObject({
  rage_count: z.number(),
  rage_damage_bonus: z.number(),
  brutal_critical_dice: z.number(),
});

export const MonkSpecificSchema = z.strictObject({
  ki_points: z.number(),
  unarmored_movement: z.number(),
  martial_arts: DiceSchema,
});

export const RogueSpecificSchema = z.strictObject({
  sneak_attack: DiceSchema,
});

// ... similar for each class with unique progression values

// Union of all class-specific schemas
export const ClassSpecificSchema = z.union([
  BarbarianSpecificSchema,
  MonkSpecificSchema,
  RogueSpecificSchema,
  FighterSpecificSchema,
  SorcererSpecificSchema,
  WarlockSpecificSchema,
  WizardSpecificSchema,
  // Classes without class_specific: bard, cleric, druid, paladin, ranger
]);

// Subclass-specific (e.g., Assassin, Berserker bonuses)
export const SubclassSpecificSchema = z.record(z.string(), z.unknown());

export const LevelSchema = z.strictObject({
  index: z.string(),
  level: z.number(),
  ability_score_bonuses: z.number().optional(),
  prof_bonus: z.number().optional(),
  features: z.array(APIReferenceSchema).optional(),
  class: APIReferenceSchema,
  class_specific: ClassSpecificSchema.optional(),
  spellcasting: LevelSpellcastingSchema.optional(),
  subclass: APIReferenceSchema.optional(),
  subclass_specific: SubclassSpecificSchema.optional(),
  url: z.string(),
});
```

**class-2024.ts** - For all 12 PHB classes (compare with 5e-database existing)

### Phase 4: Parameterize Validation (validate.ts)

Add schema registry to support multiple entity types:

```typescript
const REGISTRY = {
  spell: { schema: SpellSchema, output: '5e-SRD-Spells.json' },
  class: { schema: ClassSchema, output: '5e-SRD-Classes.json' },
  subclass: { schema: SubclassSchema, output: '5e-SRD-Subclasses.json' },
  feature: { schema: FeatureSchema, output: '5e-SRD-Features.json' },
  level: { schema: LevelSchema, output: '5e-SRD-Levels.json' },
};
```

Reference checks per entity type:

- **classes**: Validate ability score refs, proficiency refs
- **subclasses**: Validate `class.index` is valid, `subclass_levels` URL format
- **features**: Validate `class`/`subclass` refs, level 1-20
- **levels**: Validate feature refs exist, class_specific matches class

### Phase 5: Create Extraction Prompts

**Multi-entity extraction strategy:** Each subclass HTML contains both subclass metadata AND features. Run two extraction passes per file:

1. First pass: subclass-extraction.md → emits 1 subclass JSON
2. Second pass: feature-extraction.md → emits N feature JSONs (one per feature section)

This keeps prompts focused and allows independent validation of each entity type.

**subclass-extraction.md** - Extract subclass metadata (not features):

- `index`: subclass slug (e.g., `college-of-glamour`)
- `class`: derive from filename prefix
- `subclass_flavor`: the category name (e.g., "Bard College", "Primal Path")
- `desc[]`: intro paragraphs before features
- `subclass_levels`: `/api/2024/subclasses/<index>/levels`
- `spells[]`: expanded spell list if present (look for "always prepared" spell tables)

**feature-extraction.md** - Extract features as separate entities:

- One feature per `### Level N: Feature Name` section
- `index`: `<subclass>-<level>-<feature-name-slug>` (include level to ensure uniqueness)
- `class`: parent class reference
- `subclass`: parent subclass reference (if subclass feature)
- `parent`: for invocations/metamagic, reference to main feature (e.g., `eldritch-invocations`)
- `level`: parse from header (handle "Level 3:", "3rd Level:", "### 3rd-Level" variants)
- `prerequisites[]`: parse "Prerequisite:" lines if present (e.g., "Prerequisite: 5th level, Pact of the Blade")
- `feature_specific`: for features with choosable options (invocations list, subfeature_options)
- `desc[]`: feature description paragraphs

**level-extraction.md** - Extract level progression from CLASS pages (not subclass pages):

- Source: `data/raw/class/<class>.html` - the level table on each class main page
- 20 levels per class
- Parse level tables for `prof_bonus`, `class_specific` values
- `features[]`: references to features gained at that level
- `index`: `<class>-<level>` (e.g., `barbarian-1`, `barbarian-2`)

**class-extraction.md** - Extract/verify class data:

- Source: `data/raw/class/<class>.html`
- All 12 classes exist in 5e-database; extract to compare/validate
- Focus on fields that may have changed in 2024: hit_die, proficiencies, saving_throws

**Wiki format observed:**

```markdown
# College of Glamour

Source: Player's Handbook

_Weave Beguiling Fey Magic_
The College of Glamour traces its origins to...

### Level 3: Beguiling Magic

You always have the Charm Person and Mirror Image spells prepared...

### Level 3: Mantle of Inspiration

You can weave fey magic into a song...
```

**Target outputs:**

Subclass (`data/out/subclass/college-of-glamour.json`):

```json
{
  "index": "college-of-glamour",
  "class": { "index": "bard", "name": "Bard", "url": "/api/2024/classes/bard" },
  "name": "College of Glamour",
  "subclass_flavor": "Bard College",
  "desc": ["The College of Glamour traces its origins to..."],
  "subclass_levels": "/api/2024/subclasses/college-of-glamour/levels",
  "url": "/api/2024/subclasses/college-of-glamour"
}
```

Feature (`data/out/feature/college-of-glamour-3-beguiling-magic.json`):

```json
{
  "index": "college-of-glamour-3-beguiling-magic",
  "class": { "index": "bard", "name": "Bard", "url": "/api/2024/classes/bard" },
  "subclass": {
    "index": "college-of-glamour",
    "name": "College of Glamour",
    "url": "/api/2024/subclasses/college-of-glamour"
  },
  "name": "Beguiling Magic",
  "level": 3,
  "prerequisites": [],
  "desc": [
    "You always have the Charm Person and Mirror Image spells prepared..."
  ],
  "url": "/api/2024/features/college-of-glamour-3-beguiling-magic"
}
```

### Phase 6: Run Extraction (order matters!)

**Extraction order due to cross-entity references:**

1. **Classes first** - Verify/update existing 12 classes
2. **Subclasses second** - References classes
3. **Features third** - References classes and subclasses
4. **Levels last** - References features, classes, subclasses

Use same subagent pattern as spells:

- Classes: 12 total, single agent
- Subclasses: ~48 ÷ 10 per agent = 5 agents
- Features: extracted from same source files as subclasses, ~200 features ÷ 10 = 20 agents
- Levels: 12 classes × 20 levels = 240 levels, extracted from 12 class pages = 12 agents

### Phase 7: Merge with Existing 5e-database

**Strategy:** Compare, don't blindly overwrite.

```typescript
// merge.ts
async function mergeEntities(
  extracted: Entity[],
  existing: Entity[],
): Promise<MergeResult> {
  const results = { added: [], updated: [], unchanged: [], conflicts: [] };

  for (const entity of extracted) {
    const match = existing.find((e) => e.index === entity.index);
    if (!match) {
      results.added.push(entity);
    } else if (deepEqual(match, entity)) {
      results.unchanged.push(entity);
    } else {
      // 2024 extraction takes precedence, but log diff for review
      results.updated.push({ old: match, new: entity });
    }
  }
  return results;
}
```

**For existing 12 subclasses in 5e-database:**

- Extract fresh 2024 versions
- Compare field-by-field
- Log differences for manual review before overwrite
- 2024 data is authoritative but differences may indicate extraction bugs

## Files to Modify

| File                                          | Change                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| `src/pipeline/config.ts`                      | Add CLASS_NAMES (12 classes), CLASS_AUXILIARY, CRAWL_DELAY_MS, categories |
| `src/pipeline/crawl.ts`                       | Add namespace-based class/subclass discovery, rate limiting               |
| `src/pipeline/validate.ts`                    | Add schema registry, accept category arg, reference checking              |
| `src/pipeline/merge.ts`                       | NEW - Compare extracted vs existing, log diffs, merge strategy            |
| `src/pipeline/schemas/class-2024.ts`          | NEW - ClassSchema (verify against existing 12)                            |
| `src/pipeline/schemas/subclass-2024.ts`       | NEW - SubclassSchema (2014 style)                                         |
| `src/pipeline/schemas/feature-2024.ts`        | NEW - FeatureSchema with prerequisites, parent, feature_specific          |
| `src/pipeline/schemas/level-2024.ts`          | NEW - LevelSchema with ClassSpecificSchema union                          |
| `src/pipeline/prompts/class-extraction.md`    | NEW - extraction spec for classes                                         |
| `src/pipeline/prompts/subclass-extraction.md` | NEW - subclass metadata + spells                                          |
| `src/pipeline/prompts/feature-extraction.md`  | NEW - feature entities with prerequisites                                 |
| `src/pipeline/prompts/level-extraction.md`    | NEW - level progression from class tables                                 |
| `src/pipeline/tests/subclass-2024.test.ts`    | NEW - subclass schema + extraction tests                                  |
| `src/pipeline/tests/feature-2024.test.ts`     | NEW - feature schema + level parsing tests                                |
| `src/pipeline/tests/level-2024.test.ts`       | NEW - level schema + class_specific tests                                 |
| `src/pipeline/tests/merge.test.ts`            | NEW - merge logic tests                                                   |

## Verification

```bash
# Crawl in order (with rate limiting)
npm run crawl classes       # Fetch 12 class main pages
npm run crawl subclasses    # Discover ~48 subclass pages from 12 classes

# Convert HTML to markdown
npm run convert classes
npm run convert subclasses

# Extract via subagents (ORDER MATTERS)
npm run extract classes     # 12 classes → data/out/class/
npm run extract subclasses  # ~60 subclasses → data/out/subclass/
npm run extract features    # ~200 features → data/out/feature/
npm run extract levels      # 260 levels → data/out/level/

# Validate and merge (ORDER MATTERS for reference checking)
npm run validate classes    # → data/out/5e-SRD-Classes.json
npm run validate subclasses # → data/out/5e-SRD-Subclasses.json
npm run validate features   # → data/out/5e-SRD-Features.json
npm run validate levels     # → data/out/5e-SRD-Levels.json

# Run full test suite
npm test
```

## Test Coverage

**New test files needed:**

| Test File                | Coverage                                                                         |
| ------------------------ | -------------------------------------------------------------------------------- |
| `subclass-2024.test.ts`  | Schema validation, subclass_flavor derivation, spell list parsing                |
| `feature-2024.test.ts`   | Schema validation, level parsing from headers, prerequisite parsing, parent refs |
| `level-2024.test.ts`     | Schema validation, class_specific per class, feature refs exist                  |
| `class-2024.test.ts`     | Schema validation, compare with existing 5e-database                             |
| `merge.test.ts`          | Add/update/unchanged/conflict detection                                          |
| `crawl-subclass.test.ts` | Auxiliary page filtering, rate limiting, namespace discovery                     |

**Validation test cases:**

- Feature references non-existent subclass → error
- Level references non-existent feature → error
- class_specific fields match expected class schema
- Index uniqueness across all features
- All 12 classes have 20 levels
- Subclass spell lists reference valid spells
- Eldritch Invocations have `parent` reference to main feature
- Metamagic options use `feature_specific.subfeature_options`

## Risks & Mitigations

| Risk                          | Impact                      | Mitigation                                                            |
| ----------------------------- | --------------------------- | --------------------------------------------------------------------- |
| **Auxiliary page detection**  | Wrong pages crawled         | Start with known patterns, log unexpected slugs, iterate              |
| **Feature level parsing**     | Wrong level assignments     | Handle variants: "Level 3:", "### 3rd Level", "3rd-Level Features"    |
| **Parent class derivation**   | Orphaned features           | Use filename convention `<class>--<slug>` to preserve context         |
| **Cross-entity references**   | Validation failures         | Strict extraction order: classes → subclasses → features → levels     |
| **Class-specific fields**     | Schema mismatches           | Per-class discriminated union schema with exhaustive type coverage    |
| **Subclass flavor detection** | Wrong flavor text           | Derive from class: barbarian→"Primal Path", bard→"Bard College", etc. |
| **Level table parsing**       | Missing class_specific data | Complex tables need careful extraction; may need custom parsing       |
| **Wiki rate limiting**        | IP blocked                  | 500ms delay between requests, exponential backoff on 429              |
| **Merge conflicts**           | Data loss                   | Log all diffs, require manual review before overwriting existing data |
| **Index collisions**          | Duplicate keys              | Include level in feature index: `<subclass>-<level>-<feature>`        |
| **Prerequisite parsing**      | Missing prereqs             | Look for "Prerequisite:" prefix, handle multi-condition prereqs       |
| **Expanded spell lists**      | Missing subclass spells     | Parse "always prepared" tables, cross-ref against spell index         |

## 2014 Compatibility Notes

These patterns follow 2014 schema for maximum compatibility:

| Pattern                  | 2014 Approach                                       | Implementation                                         |
| ------------------------ | --------------------------------------------------- | ------------------------------------------------------ |
| **Eldritch Invocations** | Features with `parent` field                        | Extract as Features, `parent` → `eldritch-invocations` |
| **Metamagic**            | Features with `feature_specific.subfeature_options` | Extract as Features with subfeature structure          |
| **Multiclassing**        | Inline `multi_classing` on Class                    | Already in 5e-database Classes, no extraction needed   |
| **Optional Features**    | Not in 2014 SRD                                     | Skip - out of scope                                    |
| **Fighting Styles**      | Features chosen from options                        | Extract as Features with `feature_specific`            |
