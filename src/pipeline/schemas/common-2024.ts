import * as z from 'zod/v4';

/**
 * Shared 2024 sub-schemas, mirroring the recursive `Choice`/`option_set` shape
 * (and its helpers) in node_modules/5e-database/src/schemas/common.ts, but
 * re-expressed in `zod/v4` + `z.strictObject` to match this project's files.
 *
 * Kept here rather than redeclared per entity file because ChoiceSchema is large
 * and recursive; the background/species/trait schemas import it. (The per-file
 * `APIReferenceSchema` idiom is still followed in the entity files; the copy here
 * is the one ChoiceSchema's options reference.) Imported from `zod/v4` to avoid
 * mixing zod-root (5e-database) and zod/v4 schema instances in the parser.
 */
export const APIReferenceSchema = z.strictObject({
  index: z
    .string()
    .describe(`slug, in kebab-case, strip "'", e.g. tasha's -> tashas`),
  name: z.string(),
  url: z
    .string()
    .describe(
      `url, in the following format /api/2024/<category>/<index> \n categories list: proficiencies, ability-scores, feats, equipment, backgrounds, classes, subclasses, conditions, equipment-categories, damage-types, weapon-properties, weapon-mastery-properties, spells, features, languages, magic-items, poisons, skills, traits, species, subspecies, magic-schools`,
    ),
});

export const AreaOfEffectSchema = z.strictObject({
  type: z.enum(['sphere', 'cube', 'cylinder', 'line', 'cone']),
  size: z.number(),
});

export const DifficultyClassSchema = z.strictObject({
  dc_type: APIReferenceSchema,
  dc_value: z.number().optional(),
  success_type: z.enum(['none', 'half', 'other']),
});

export const DamageSchema = z.strictObject({
  damage_type: APIReferenceSchema,
  damage_dice: z.string(),
});

/**
 * A feature's or feat's effect on Armor Class, made machine-readable so a builder
 * can fold it into the computed AC instead of parsing prose. Two shapes,
 * discriminated by `calculation`:
 *
 *  - `unarmored_defense` — while you wear no armor, your base AC becomes `base`
 *    plus the modifiers of the listed `abilities` (Barbarian 10+Dex+Con, Monk
 *    10+Dex+Wis, Draconic Resilience / Dazzling Footwork / Genie's Splendor
 *    10+Dex+Cha). `shield_allowed` says whether a Shield may still be added on top
 *    (Barbarian/Paladin yes, Monk/Bard no — those say "or wielding a Shield").
 *  - `flat_bonus` — a flat +N to AC, gated by `armor`: 'armored' applies only while
 *    wearing Light/Medium/Heavy armor (Defense Fighting Style), 'unarmored' only
 *    while wearing none, 'any' unconditionally.
 *
 * A bonus granted only by an activated form/stance carries the owning entity's
 * `activation`; a builder applies passive effects (no activation) automatically and
 * treats activated ones (Wrath of the Wild) as situational.
 *
 * Leave the effect in `desc` (do NOT model it here) when its value depends on a
 * player choice the entity itself defines (Infernal Bulwark's "the ability
 * increased by this feat"), or when it is random/temporary or only sets AC inside a
 * special form (Wild Shape, a Wild Magic surge, a Reaction like Defensive Duelist).
 */
export const ArmorClassEffectSchema = z.union([
  z.strictObject({
    calculation: z.literal('unarmored_defense'),
    base: z.number().int().describe('flat starting value, almost always 10'),
    abilities: z
      .array(APIReferenceSchema)
      .min(1)
      .describe(
        'ability-scores refs whose modifiers add to `base` while unarmored, in display order (e.g. [dex, con])',
      ),
    shield_allowed: z
      .boolean()
      .describe('true if a Shield may still be added on top of this formula'),
  }),
  z.strictObject({
    calculation: z.literal('flat_bonus'),
    bonus: z
      .number()
      .int()
      .describe('flat AC bonus at the level gained; later level-scaling stays in desc'),
    armor: z
      .enum(['any', 'armored', 'unarmored'])
      .describe(
        "when it applies: 'armored' = only while wearing Light/Medium/Heavy armor, " +
          "'unarmored' = only while wearing no armor, 'any' = unconditional",
      ),
  }),
]);

// An option may nest a Choice or a `multiple` bundle of options, so this is
// recursive — defer resolution with z.lazy (same approach as common.ts).
const OptionSchema: z.ZodType<any> = z.lazy(() =>
  z.union([
    z.strictObject({
      option_type: z.literal('reference'),
      item: APIReferenceSchema,
    }),
    z.strictObject({ option_type: z.literal('choice'), choice: ChoiceSchema }),
    z.strictObject({ option_type: z.literal('string'), string: z.string() }),
    z.strictObject({
      option_type: z.literal('ability_bonus'),
      ability_score: APIReferenceSchema,
      bonus: z.number(),
    }),
    z.strictObject({
      option_type: z.literal('action'),
      action_name: z.string(),
      count: z.number(),
      type: z.string(),
      desc: z.string().optional(),
    }),
    z.strictObject({
      option_type: z.literal('breath'),
      name: z.string(),
      dc: DifficultyClassSchema,
      damage: z.array(DamageSchema).optional(),
    }),
    z.strictObject({
      option_type: z.literal('counted_reference'),
      count: z.number(),
      of: APIReferenceSchema,
      prerequisites: z
        .array(
          z.strictObject({
            type: z.string(),
            proficiency: APIReferenceSchema.optional(),
          }),
        )
        .optional(),
    }),
    z.strictObject({
      option_type: z.literal('damage'),
      damage_dice: z.string(),
      damage_type: APIReferenceSchema,
      notes: z.string().optional(),
    }),
    z.strictObject({
      option_type: z.literal('ideal'),
      alignments: z.array(APIReferenceSchema),
      desc: z.string(),
    }),
    z.strictObject({
      option_type: z.literal('money'),
      count: z.number(),
      unit: z.string(),
    }),
    z.strictObject({
      option_type: z.literal('multiple'),
      items: z.array(OptionSchema),
      desc: z.string().optional(),
    }),
    z.strictObject({
      option_type: z.literal('score_prerequisite'),
      ability_score: APIReferenceSchema,
      minimum_score: z.number(),
    }),
    z.strictObject({ option_type: z.literal('size'), size: z.string() }),
  ]),
);

const OptionSetSchema = z.union([
  z.strictObject({
    option_set_type: z.literal('equipment_category'),
    equipment_category: APIReferenceSchema,
  }),
  z.strictObject({
    option_set_type: z.literal('resource_list'),
    resource_list_url: z.string(),
  }),
  z.strictObject({
    option_set_type: z.literal('options_array'),
    options: z.array(z.union([OptionSchema, z.string()])),
  }),
]);

/**
 * For a spells-type choice, a structured description of which spells are
 * selectable, so a builder can enumerate them instead of parsing the desc prose.
 * The pool is the spell list filtered by `level` (exact) or `max_level` (≤), then
 * by `classes` / `schools` / `casting_time` / `ritual_only` / `requires_attack_roll` /
 * `deals_damage` / `min_range_feet`, with any `also_spells` unioned in.
 * `from_class_choice` marks the case where the class to draw from is
 * itself the player's pick in another (`classes`) choice on the same feat (Magic
 * Initiate). Provide exactly one of `level` / `max_level`.
 */
export const SpellSourceSchema = z.strictObject({
  level: z
    .number()
    .optional()

    .describe('exact spell level to draw from; 0 = cantrip'),
  max_level: z
    .number()
    .optional()

    .describe(
      'maximum spell level, for "a level N or lower spell" (Boon of Siberys)',
    ),
  classes: z
    .array(z.string())
    .optional()

    .describe(
      'class index(es) whose spell list to draw from; omit for any class',
    ),
  schools: z
    .array(z.string())
    .optional()

    .describe('magic-school index(es) to filter by; omit for any school'),
  from_class_choice: z
    .boolean()
    .optional()

    .describe(
      "true when the class to draw from is the player's pick in this feat's own classes choice (Magic Initiate)",
    ),
  ritual_only: z
    .boolean()
    .optional()

    .describe(
      'true when only spells with the Ritual tag qualify (Ritual Caster)',
    ),
  casting_time: z
    .enum(['action', 'bonus_action', 'reaction'])
    .optional()

    .describe(
      'restrict to spells with this casting time (Genie Magic: "a casting time of an action"); omit for no restriction',
    ),
  requires_attack_roll: z
    .boolean()
    .optional()

    .describe(
      'true when only spells that require an attack roll qualify — i.e. the spell has an `attack_type` (Repelling Blast: "a cantrip that requires an attack roll"). Omit for no restriction.',
    ),
  deals_damage: z
    .boolean()
    .optional()

    .describe(
      'true when only damage-dealing spells qualify — i.e. the spell has a `damage` block (Agonizing Blast / Eldritch Spear: "a cantrip that deals damage"). Omit for no restriction.',
    ),
  min_range_feet: z
    .number()
    .optional()

    .describe(
      'minimum spell range in feet, for "a range of N+ feet" (Eldritch Spear: "a range of 10+ feet" → 10). Excludes Self/Touch spells. Omit for no restriction.',
    ),
  also_spells: z
    .array(z.string())
    .optional()

    .describe(
      "explicit spell indexes added to the pool on top of the filtered list — a feat-specific list the filters can't express (Boon of Siberys's Siberys Dragonmark Spells table)",
    ),
});

export const ChoiceSchema: z.ZodType<any> = z.lazy(() =>
  z.strictObject({
    desc: z.string().optional(),
    choose: z.number(),
    type: z.string().optional(),
    from: OptionSetSchema,
    grants: z
      .enum(['proficiency', 'expertise', 'proficiency_or_expertise'])
      .optional()

      .describe(
        'for a proficiencies-type choice, what the pick confers: a plain proficiency, Expertise (you already have the proficiency), or proficiency-if-lacking-else-Expertise (Keen Mind, Observant). Omit (= proficiency) for non-proficiency choices.',
      ),
    ability_use: z
      .enum(['increase', 'spellcasting', 'hit_points'])
      .optional()

      .describe(
        "for an abilities-type choice, what picking the ability does: raise that score by 1 (increase), set this feat's spellcasting ability (spellcasting), or set the ability for a hit-point calculation (hit_points). Omit (= increase) for an ordinary Ability Score Increase.",
      ),
    spell_source: SpellSourceSchema.optional(),
  }),
);
