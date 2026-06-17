import * as z from 'zod/v4';
import {
  APIReferenceSchema,
  DamageSchema,
  DifficultyClassSchema,
} from './common-2024.ts';

/**
 * 2024-edition base (mundane) Equipment schema.
 *
 * Our authoritative 2024 equipment reference set, used to resolve the
 * `starting_equipment` / `starting_equipment_options` of backgrounds and classes
 * and the `reference`s of tool proficiencies (all `/api/2024/equipment/<index>`).
 *
 * Extracted from the wiki's table pages (`equipment:weapon` / `:armor` /
 * `:adventuring-gear` / `:tool` / `:mounts-and-vehicles`) one record per table row
 * — see `prompts/equipment-extraction.md`. Magic items are a separate category
 * (`magic-item-2024.ts`).
 *
 * Modeled on `node_modules/5e-database/src/2024/schemas/5e-SRD-Equipment.ts`, with
 * sub-schemas reused from `common-2024.ts`. Divergences from 5e-database, driven by
 * the 2024 wiki source: `cost` is optional (grouped items like Arcane Focus / Holy
 * Symbol / Ammunition list "Varies"), and `ability` is carried for tools.
 */

const CostSchema = z.strictObject({
  quantity: z.number(),
  unit: z
    .enum(['cp', 'sp', 'ep', 'gp', 'pp'])
    .describe('coin unit, lowercased: cp/sp/ep/gp/pp'),
});

const ArmorClassSchema = z.strictObject({
  base: z.number().describe('base AC, or the bonus for a Shield (+2)'),
  dex_bonus: z.boolean(),
  max_bonus: z
    .number()
    .optional()
    .describe('Dex bonus cap for Medium armor (max 2); omit if uncapped'),
});

const RangeSchema = z.strictObject({
  normal: z.number(),
  long: z.number().optional(),
});

const ThrowRangeSchema = z.strictObject({
  normal: z.number(),
  long: z.number(),
});

const ContentSchema = z.strictObject({
  item: APIReferenceSchema,
  quantity: z.number(),
});

const UtilizeSchema = z.strictObject({
  name: z.string(),
  dc: DifficultyClassSchema,
});

export const EquipmentSchema = z.strictObject({
  index: z
    .string()
    .describe("kebab-case slug, e.g. 'longsword', 'leather-armor'"),
  name: z.string(),
  equipment_categories: z
    .array(APIReferenceSchema)
    .describe(
      'the equipment-categories this item belongs to (most specific first)',
    ),
  url: z.string().describe('/api/2024/equipment/<index>'),
  cost: CostSchema.optional().describe(
    "omit for 'Varies' grouped items / services",
  ),
  weight: z.number().optional().describe("in pounds; '1/4 lb.' -> 0.25"),
  description: z.string().optional(),
  // Weapons.
  damage: DamageSchema.optional(),
  two_handed_damage: DamageSchema.optional().describe(
    'the Versatile (NdM) two-handed damage',
  ),
  range: RangeSchema.optional().describe(
    'Ammunition (Range x/y) -> {normal:x, long:y}',
  ),
  throw_range: ThrowRangeSchema.optional().describe(
    'Thrown (Range x/y) -> {normal:x, long:y}',
  ),
  properties: z
    .array(APIReferenceSchema)
    .optional()
    .describe('weapon-properties refs'),
  mastery: APIReferenceSchema.optional().describe(
    'weapon-mastery-properties ref',
  ),
  // Armor.
  armor_class: ArmorClassSchema.optional(),
  str_minimum: z.number().optional(),
  stealth_disadvantage: z.boolean().optional(),
  // Tools.
  ability: APIReferenceSchema.optional().describe(
    'ability-scores ref the tool uses',
  ),
  utilize: z.array(UtilizeSchema).optional(),
  // Packs.
  contents: z.array(ContentSchema).optional(),
});

export type Equipment = z.infer<typeof EquipmentSchema>;
