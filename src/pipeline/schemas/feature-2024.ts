import * as z from 'zod/v4';

/**
 * 2024-edition Feature schema (2014-compatible structure).
 *
 * Features are separate entities, can belong to a class OR subclass.
 * Eldritch Invocations/Metamagic use `parent` to link to main feature.
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

/** Prerequisites for a feature (level, other feature, pact, etc.). */
export const FeaturePrerequisiteSchema = z.strictObject({
  type: z.enum(['level', 'feature', 'spell', 'proficiency']),
  level: z.number().optional(),
  feature: z.string().optional(),
  spell: z.string().optional(),
  proficiency: z.string().optional(),
});

/**
 * One spell a feature lets you cast outside your normal spellcasting — the 2024
 * "free spellcasting" features: an Eldritch Invocation (Armor of Shadows → cast
 * Mage Armor without a slot) or a subclass grant (Great Old One's Eldritch Hex →
 * always have Hex prepared). The exact rules text stays in `desc`; this is the
 * machine-readable grant so a character builder can surface the spell.
 */
export const FeatureSpellGrantSchema = z.strictObject({
  spell: APIReferenceSchema.describe('the granted spell, referencing the real spell entity'),
  usage: z
    .enum(['at_will', 'per_long_rest', 'always_prepared'])
    .describe(
      'how the feature lets you cast it: at_will = cast without a spell slot any number of ' +
        'times; per_long_rest = a limited number of free (slotless) casts per Long Rest (see ' +
        '`times`); always_prepared = the spell is always prepared and cast with normal spell slots',
    ),
  times: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('free casts per Long Rest when usage is per_long_rest (e.g. Water Breathing: 1)'),
  self_only: z
    .boolean()
    .optional()
    .describe('true when the free cast may target only yourself (Armor of Shadows, Ascendant Step)'),
});

/**
 * Spells a feature confers the ability to cast. Present only when the feature
 * grants specific, named spells; a "choose a spell to learn" pick or a
 * conditional "when you cast a [school] spell" rider is NOT modeled here.
 */
export const FeatureSpellcastingSchema = z.strictObject({
  ability: APIReferenceSchema.optional().describe(
    "the spellcasting ability for these spells; omit to use the granting class's own " +
      "spellcasting ability (the usual case — an invocation uses the Warlock's Charisma)",
  ),
  spells: z
    .array(FeatureSpellGrantSchema)
    .min(1)
    .describe('the specific spells the feature grants, each with how it can be cast'),
});

/** Feature-specific data for features with choosable options or granted spells. */
export const FeatureSpecificSchema = z.strictObject({
  subfeature_options: z
    .strictObject({
      choose: z.number(),
      type: z.string(),
      from: z.strictObject({
        option_set_type: z.string(),
        options: z.array(
          z.strictObject({
            option_type: z.string(),
            item: APIReferenceSchema,
          }),
        ),
      }),
    })
    .optional(),
  expertise_options: z
    .strictObject({
      choose: z.number(),
      type: z.string(),
      from: z.strictObject({
        option_set_type: z.string(),
        options: z.array(z.unknown()),
      }),
    })
    .optional(),
  invocations: z.array(APIReferenceSchema).optional(),
  spellcasting: FeatureSpellcastingSchema.optional(),
});

export const FeatureSchema = z.strictObject({
  index: z.string().describe('unique slug: <subclass>-<level>-<feature-name>'),
  name: z.string(),
  level: z.number().int().min(1).max(20),
  class: APIReferenceSchema.optional().describe('parent class reference'),
  subclass: APIReferenceSchema.optional().describe('parent subclass reference'),
  parent: APIReferenceSchema.optional().describe(
    'for invocations/metamagic: main feature ref',
  ),
  desc: z.array(z.string()).describe('feature description paragraphs'),
  prerequisites: z.array(FeaturePrerequisiteSchema).describe('empty if none'),
  feature_specific: FeatureSpecificSchema.optional().describe(
    'for features with options',
  ),
  url: z.string().describe('/api/2024/features/<index>'),
});

export type Feature = z.infer<typeof FeatureSchema>;
