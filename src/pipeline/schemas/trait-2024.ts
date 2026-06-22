import * as z from 'zod/v4';
import {
  AreaOfEffectSchema,
  ChoiceSchema,
  DifficultyClassSchema,
} from './common-2024.ts';

/**
 * 2024-edition Trait schema — the full 2014 trait shape, renamed only
 * (races/subraces -> species/subspecies). Keeps `parent` (e.g. Draconic Ancestry
 * variants) and the detailed `trait_specific` (breath weapon, damage type, innate
 * spellcasting, spell and subtrait options) so structured species mechanics survive.
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

/** Dragonborn-style breath weapon (2014 shape). */
export const BreathWeaponSchema = z.strictObject({
  name: z.string(),
  desc: z.string(),
  area_of_effect: AreaOfEffectSchema,
  usage: z.strictObject({ type: z.string(), times: z.number() }),
  dc: DifficultyClassSchema,
  damage: z
    .array(
      z.strictObject({
        damage_type: APIReferenceSchema,
        damage_at_character_level: z.record(z.string(), z.string()),
      }),
    )
    .optional(),
});

/**
 * One spell a trait grants outright at a fixed character level (2024
 * lineage/legacy innate magic, e.g. Fiendish Legacy, Elven Lineage). A cantrip
 * is gained at character level 1; higher-level spells become always-prepared
 * with a free daily cast (the exact free-cast economy stays in `desc`).
 */
export const TraitSpellGrantSchema = z.strictObject({
  spell: APIReferenceSchema,
  level: z
    .number()
    .int()
    .min(1)
    .describe('character level at which the spell is gained (cantrips at level 1)'),
  swappable_from: z
    .array(z.string())
    .optional()
    .describe(
      'class index(es) whose list this cantrip may be swapped for on a Long Rest ' +
        '(High Elf: ["wizard"]; Khoravar: ["cleric","druid","wizard"]). Omit when the spell is fixed.',
    ),
});

/**
 * Innate spellcasting a trait confers: the ability used and the spells granted
 * by character level. Present only when the trait grants spells outright; a
 * "choose a cantrip/spell to learn" pick is `spell_options` instead.
 */
export const TraitSpellcastingSchema = z.strictObject({
  ability: z
    .array(APIReferenceSchema)
    .describe(
      'spellcasting ability for these spells: a single fixed ability ' +
        '(Aasimar Light Bearer: [CHA]) or the abilities the player chooses among ' +
        '(legacies/lineages: [INT, WIS, CHA])',
    ),
  spells: z
    .array(TraitSpellGrantSchema)
    .describe('the spells the trait grants, each tagged with the character level it is gained'),
});

/** Trait-specific structured data (2014 shape). */
export const TraitSpecificSchema = z.strictObject({
  damage_type: APIReferenceSchema.optional(),
  breath_weapon: BreathWeaponSchema.optional(),
  spellcasting: TraitSpellcastingSchema.optional(),
  spell_options: ChoiceSchema.optional(),
  subtrait_options: ChoiceSchema.optional(),
});

export const TraitSchema = z.strictObject({
  index: z
    .string()
    .describe("slugify('<parent-species-or-subspecies>-<trait-name>')"),
  name: z.string(),
  species: z
    .array(APIReferenceSchema)
    .describe('species this trait belongs to'),
  subspecies: z
    .array(APIReferenceSchema)
    .describe('subspecies this trait belongs to'),
  desc: z.array(z.string()),
  proficiencies: z.array(APIReferenceSchema).optional(),
  proficiency_choices: z
    .array(ChoiceSchema)
    .optional()
    .describe(
      'one Choice per distinct proficiency pick the trait offers; usually one, but e.g. Warforged Specialized Design grants a separate skill choice AND tool choice. Omit if none.',
    ),
  language_options: ChoiceSchema.optional(),
  feat_options: ChoiceSchema.optional().describe(
    'a single Choice when the trait grants a feat of the player\'s choice (Human Versatile: "an Origin feat of your choice"). Model as a resource_list over the relevant feat category, e.g. from.resource_list_url "/api/2024/feats?type=origin". Omit when the trait grants no feat pick.',
  ),
  parent: APIReferenceSchema.optional().describe(
    'e.g. Draconic Ancestry (Black) -> Draconic Ancestry',
  ),
  trait_specific: TraitSpecificSchema.optional(),
  url: z.string().describe('/api/2024/traits/<index>'),
});

export type Trait = z.infer<typeof TraitSchema>;
