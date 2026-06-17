import * as z from 'zod/v4';

/**
 * 2024-edition Spell schema.
 *
 * Adapted from node_modules/5e-database/src/2014/schemas/5e-SRD-Spells.ts
 * (the 2024 dataset ships no spell schema). The structured combat fields the
 * 2014 API carried — `attack_type`, `damage`, `dc`, `area_of_effect`,
 * `heal_at_slot_level` — are reconstructed from the wiki prose: the page states
 * base dice/AoE/save inline in the description and expresses scaling as prose
 * ("Using a Higher-Level Spell Slot" / "Cantrip Upgrade") rather than tables, so
 * the extractor derives the per-level records from that prose. Each is optional
 * and present only when the text supports it.
 *
 * `subclasses` is kept in the schema for 2014 compatibility but is never
 * populated: the wiki spell pages carry no subclass spell-list associations.
 *
 * Imported from `zod/v4` to match @anthropic-ai/sdk's `zodOutputFormat` helper,
 * which imports the same. `APIReferenceSchema` mirrors
 * node_modules/5e-database/src/schemas/common.ts exactly (kept local rather than
 * imported to avoid mixing zod-root and zod/v4 schema instances in the parser).
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

/**
 * 2014-compatible spell damage. All members optional: a spell may state a
 * damage type with no dice, scale by slot level (leveled spells), or scale by
 * character level (cantrips). Keys are level numbers as strings; values are
 * dice expressions, e.g. {"3":"8d6","4":"9d6"} or {"1":"1d10","5":"2d10"}.
 */
export const SpellDamageSchema = z.strictObject({
  damage_type: APIReferenceSchema.optional(),
  damage_at_slot_level: z.record(z.string(), z.string()).optional(),
  damage_at_character_level: z.record(z.string(), z.string()).optional(),
});

/** 2014-compatible saving-throw descriptor. `dc_type` is an ability-score reference. */
export const SpellDCSchema = z.strictObject({
  dc_type: APIReferenceSchema,
  dc_success: z.enum(['none', 'half', 'other']),
  desc: z.string().optional(),
});

/** 2014-compatible area of effect, mirroring common.ts AreaOfEffectSchema. */
export const AreaOfEffectSchema = z.strictObject({
  type: z.enum(['sphere', 'cube', 'cylinder', 'line', 'cone']),
  size: z.number(),
});

export const SpellSchema = z.strictObject({
  index: z.string().describe("kebab-case slug of the name, e.g. 'fire-bolt'"),
  name: z.string(),
  level: z.number().int().min(0).max(9).describe('0 for cantrips'),
  school: APIReferenceSchema,
  casting_time: z
    .string()
    .describe("e.g. 'Action', 'Bonus Action', '1 Minute'"),
  range: z.string().describe("e.g. 'Self', '150 feet', 'Touch'"),
  components: z
    .array(z.enum(['V', 'S', 'M']))
    .describe('subset of V, S, M in that order'),
  material: z
    .string()
    .optional()
    .describe(
      'material component text, present only when components include M',
    ),
  ritual: z.boolean(),
  concentration: z.boolean(),
  duration: z
    .string()
    .describe("e.g. 'Instantaneous', 'Concentration, up to 1 Minute'"),
  desc: z
    .array(z.string())
    .describe('body paragraphs, excluding the higher-level paragraph'),
  higher_level: z
    .array(z.string())
    .optional()
    .describe(
      "the 'Using a Higher-Level Spell Slot' / cantrip-upgrade paragraph(s)",
    ),
  attack_type: z
    .enum(['ranged', 'melee'])
    .optional()
    .describe('present only when the spell requires a spell attack roll'),
  damage: SpellDamageSchema.optional().describe(
    'present only when the spell deals dice-based damage; scaling derived from prose',
  ),
  dc: SpellDCSchema.optional().describe(
    'present only when the spell forces a saving throw',
  ),
  area_of_effect: AreaOfEffectSchema.optional().describe(
    'present only when the spell affects a geometric area',
  ),
  heal_at_slot_level: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "healing per slot level, e.g. {'1':'2d8','2':'3d8'}; derived from prose",
    ),
  classes: z
    .array(APIReferenceSchema)
    .describe('class spell lists this spell appears on'),
  subclasses: z
    .array(APIReferenceSchema)
    .optional()
    .describe(
      '2014-compat; never populated — wiki carries no subclass associations',
    ),
  url: z.string().describe('/api/2024/spells/<index>'),
});

export type Spell = z.infer<typeof SpellSchema>;
