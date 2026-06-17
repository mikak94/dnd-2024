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

/** Feature-specific data for features with choosable options. */
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
