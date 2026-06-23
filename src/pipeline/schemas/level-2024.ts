import * as z from 'zod/v4';

/**
 * 2024-edition Level schema (2014-compatible structure).
 *
 * Per-level progression with class-specific values (rage_count, ki_points, etc.).
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

/** Dice expression, e.g., for Martial Arts or Sneak Attack. */
export const DiceSchema = z.strictObject({
  dice_count: z.number(),
  dice_value: z.number(),
});

/** Barbarian-specific level progression. */
export const BarbarianSpecificSchema = z.strictObject({
  rage_count: z.number(),
  rage_damage_bonus: z.number(),
  brutal_critical_dice: z.number(),
});

/** Monk-specific level progression. */
export const MonkSpecificSchema = z.strictObject({
  ki_points: z.number(),
  unarmored_movement: z.number(),
  martial_arts: DiceSchema,
});

/** Rogue-specific level progression. */
export const RogueSpecificSchema = z.strictObject({
  sneak_attack: DiceSchema,
});

/** Fighter-specific level progression (Extra Attack). */
export const FighterSpecificSchema = z.strictObject({
  extra_attacks: z.number(),
  action_surges: z.number(),
  indomitable_uses: z.number(),
});

/** Sorcerer-specific level progression. */
export const SorcererSpecificSchema = z.strictObject({
  sorcery_points: z.number(),
  metamagic_known: z.number(),
});

/** Warlock-specific level progression. */
export const WarlockSpecificSchema = z.strictObject({
  invocations_known: z.number(),
  mystic_arcanum_level_6: z.number().optional(),
  mystic_arcanum_level_7: z.number().optional(),
  mystic_arcanum_level_8: z.number().optional(),
  mystic_arcanum_level_9: z.number().optional(),
});

/** Wizard-specific (arcane recovery). */
export const WizardSpecificSchema = z.strictObject({
  arcane_recovery_levels: z.number(),
});

/** Union of all class-specific schemas. */
export const ClassSpecificSchema = z.union([
  BarbarianSpecificSchema,
  MonkSpecificSchema,
  RogueSpecificSchema,
  FighterSpecificSchema,
  SorcererSpecificSchema,
  WarlockSpecificSchema,
  WizardSpecificSchema,
]);

/** Spellcasting progression at a given level. */
export const LevelSpellcastingSchema = z.strictObject({
  cantrips_known: z.number().optional(),
  spells_known: z.number().optional(),
  spell_slots_level_1: z.number().optional(),
  spell_slots_level_2: z.number().optional(),
  spell_slots_level_3: z.number().optional(),
  spell_slots_level_4: z.number().optional(),
  spell_slots_level_5: z.number().optional(),
  spell_slots_level_6: z.number().optional(),
  spell_slots_level_7: z.number().optional(),
  spell_slots_level_8: z.number().optional(),
  spell_slots_level_9: z.number().optional(),
});

export const LevelSchema = z.strictObject({
  index: z.string().describe("<class>-<level>, e.g. 'barbarian-1'"),
  level: z.number().int().min(1).max(20),
  ability_score_bonuses: z.number().optional(),
  prof_bonus: z.number().optional(),
  features: z
    .array(APIReferenceSchema)
    .optional()
    .describe('features gained at this level'),
  class: APIReferenceSchema,
  class_specific: ClassSpecificSchema.optional().describe(
    'class-specific progression values',
  ),
  spellcasting: LevelSpellcastingSchema.optional(),
  subclass: APIReferenceSchema.optional(),
  url: z.string().describe('/api/2024/classes/<class>/levels/<level>'),
});

export type Level = z.infer<typeof LevelSchema>;
