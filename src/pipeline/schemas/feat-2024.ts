import * as z from 'zod/v4';
import { ArmorClassEffectSchema, ChoiceSchema } from './common-2024.ts';

/**
 * 2024-edition Feat schema.
 *
 * 2014 base (`desc[]` paragraphs, `prerequisites[]`) plus the 2024-only `type`
 * (origin / general / fighting-style / epic-boon). The 2014 prerequisite shape
 * ({ability_score, minimum_score}) can't express 2024 gates like "Level 4+" or a
 * class/feat requirement, so it's generalized into a tagged union keyed by `type`.
 *
 * `choices` captures the in-feat player picks (an ability-score increase of your
 * choice, "3 skills or tools", a damage type, a spell list, …) as the shared
 * recursive ChoiceSchema, so a builder can render the selection instead of parsing
 * `desc` prose. Each distinct pick is one Choice; omitted when the feat has none.
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

/**
 * A fixed ability-score increase the feat always grants (e.g. Great Weapon
 * Master's +1 Strength, Boon of Terror's +1 Charisma). Use this ONLY when the
 * ability is not chooseable; a "choose one of …" increase is a `choices` entry
 * instead (see ChoiceSchema). Mirrors the {ability_score, bonus} shape used for
 * species/background bonuses.
 */
export const AbilityBonusSchema = z.strictObject({
  ability_score: APIReferenceSchema,
  bonus: z.number(),
});

/**
 * One prerequisite gate. `type` selects which fields are meaningful:
 *  - "ability_score": ability_score + minimum_score
 *  - "level": level
 *  - "proficiency": proficiency
 *  - "feat": feat
 *  - "spellcasting" / "other": desc (free text)
 */
export const FeatPrerequisiteSchema = z.strictObject({
  type: z.enum([
    'level',
    'ability_score',
    'proficiency',
    'feat',
    'spellcasting',
    'other',
  ]),
  level: z.number().optional(),
  ability_score: APIReferenceSchema.optional(),
  minimum_score: z.number().optional(),
  proficiency: APIReferenceSchema.optional(),
  feat: APIReferenceSchema.optional(),
  desc: z.string().optional(),
});

export const FeatSchema = z.strictObject({
  index: z
    .string()
    .describe("kebab-case slug of the name, e.g. 'great-weapon-master'"),
  name: z.string(),
  type: z
    .enum(['origin', 'general', 'fighting-style', 'epic-boon'])
    .describe('2024 feat category'),
  prerequisites: z.array(FeatPrerequisiteSchema).describe('empty if none'),
  repeatable: z
    .boolean()
    .optional()
    .describe(
      'true if the feat is Repeatable ("You can take this feat more than once"); omit otherwise',
    ),
  desc: z.array(z.string()).describe('body paragraphs'),
  ability_bonuses: z
    .array(AbilityBonusSchema)
    .optional()
    .describe(
      'fixed ability-score increases the feat always grants (not a player choice); omit if none or if the increase is chooseable (use choices)',
    ),
  choices: z
    .array(ChoiceSchema)
    .optional()
    .describe('structured in-feat player picks; omit if the feat has none'),
  armor_class: ArmorClassEffectSchema.optional().describe(
    "the feat's effect on Armor Class — e.g. the Defense Fighting Style's +1 while " +
      'armored (a flat_bonus). Omit for feats that do not change AC, or whose AC effect ' +
      "is choice-dependent (Infernal Bulwark's ability is the one this feat raised) or a " +
      'Reaction (Defensive Duelist) — those stay in desc',
  ),
  url: z.string().describe('/api/2024/feats/<index>'),
});

export type Feat = z.infer<typeof FeatSchema>;
