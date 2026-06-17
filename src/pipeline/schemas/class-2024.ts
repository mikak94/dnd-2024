import * as z from 'zod/v4';
import { ChoiceSchema } from './common-2024.ts';

/**
 * 2024-edition Class schema.
 *
 * All 12 PHB classes exist in 5e-database; extract to compare/validate.
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

/** Proficiency choice for skills, tools, etc. */
export const ProficiencyChoiceSchema = z.strictObject({
  desc: z.string().optional(),
  choose: z.number(),
  type: z.string(),
  from: z.strictObject({
    option_set_type: z.string(),
    options: z.array(
      z.strictObject({
        option_type: z.string(),
        item: APIReferenceSchema.optional(),
        choice: z
          .strictObject({
            desc: z.string().optional(),
            choose: z.number(),
            type: z.string(),
            from: z.strictObject({
              option_set_type: z.string(),
              options: z.array(z.unknown()),
            }),
          })
          .optional(),
      }),
    ),
  }),
});

/**
 * Spellcasting summary for caster classes — only the deterministic, builder-used bits:
 * `level` (the class level at which spellcasting begins) and `spellcasting_ability`.
 *
 * The 2014 `info` prose array was intentionally dropped: it's unused by the builder
 * (casting is derived from the per-level tables + engine config), it duplicates the
 * class's own "Spellcasting" feature record (see `5e-SRD-Features.json`), and its free
 * text was not reproducible across extractions.
 */
export const SpellcastingInfoSchema = z.strictObject({
  level: z.number(),
  spellcasting_ability: APIReferenceSchema,
});

/** Multiclassing prerequisites and proficiencies. */
export const MulticlassingSchema = z.strictObject({
  prerequisites: z
    .array(
      z.strictObject({
        ability_score: APIReferenceSchema,
        minimum_score: z.number(),
      }),
    )
    .optional(),
  prerequisite_options: z
    .strictObject({
      type: z.string(),
      choose: z.number(),
      from: z.strictObject({
        option_set_type: z.string(),
        options: z.array(z.unknown()),
      }),
    })
    .optional(),
  proficiencies: z.array(APIReferenceSchema).optional(),
  proficiency_choices: z.array(ProficiencyChoiceSchema).optional(),
});

export const ClassSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'barbarian'"),
  name: z.string(),
  hit_die: z.number().int().describe('e.g. 12 for barbarian, 6 for wizard'),
  proficiency_choices: z.array(ProficiencyChoiceSchema),
  proficiencies: z.array(APIReferenceSchema),
  saving_throws: z.array(APIReferenceSchema),
  starting_equipment: z.array(
    z.strictObject({
      equipment: APIReferenceSchema,
      quantity: z.number(),
    }),
  ),
  starting_equipment_options: z.array(ChoiceSchema).optional(),
  class_levels: z.string().describe('URL: /api/2024/classes/<index>/levels'),
  multi_classing: MulticlassingSchema.optional(),
  subclasses: z.array(APIReferenceSchema),
  spellcasting: SpellcastingInfoSchema.optional(),
  url: z.string().describe('/api/2024/classes/<index>'),
});

export type Class = z.infer<typeof ClassSchema>;
