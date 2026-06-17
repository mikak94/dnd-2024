import * as z from 'zod/v4';
import { ChoiceSchema } from './common-2024.ts';

/**
 * 2024-edition Background schema (2014-compatible base).
 *
 * 2024 backgrounds grant 3 ability-score options + an Origin feat + fixed skill/
 * tool proficiencies + an "equipment bundle OR gold" choice. The 2014 fields 2024
 * dropped — feature / personality_traits / ideals / bonds / flaws / language_options
 * — are omitted. Equipment is the single 2014 `starting_equipment_options` Choice
 * with the gold expressed as a `money` option inside it (no separate `starting_gold`).
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

export const BackgroundSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'acolyte'"),
  name: z.string(),
  starting_proficiencies: z
    .array(APIReferenceSchema)
    .describe('granted skill/tool proficiencies (2014 field name)'),
  ability_scores: z
    .array(APIReferenceSchema)
    .describe('the 3 ability scores this background can boost'),
  feat: APIReferenceSchema.describe('the granted Origin feat'),
  starting_equipment_options: z
    .array(ChoiceSchema)
    .optional()
    .describe(
      "'Choose bundle A or gold B'; gold is a `money` option in the Choice",
    ),
  desc: z.array(z.string()).optional().describe('flavor paragraphs'),
  url: z.string().describe('/api/2024/backgrounds/<index>'),
});

export type Background = z.infer<typeof BackgroundSchema>;
