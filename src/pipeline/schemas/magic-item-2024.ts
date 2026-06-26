import * as z from 'zod/v4';

/**
 * 2024-edition Magic Item schema.
 *
 * One record per `magic-item:<slug>` wiki page (listed on `/magic-item:all`),
 * extracted prose-first like spells — see `prompts/magic-item-extraction.md`.
 * Separate from base equipment (`equipment-2024.ts`): magic items have rarity /
 * attunement and live at `/api/2024/magic-items/<index>`.
 *
 * Modeled on `node_modules/5e-database/src/2024/schemas/5e-SRD-Magic-Items.ts`.
 * `image` is optional (the wiki carries none); `variants` defaults to empty (the
 * wiki lists most sub-variants inline in a table, not as separate pages).
 */

export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

const RaritySchema = z.strictObject({
  name: z
    .string()
    .describe(
      'Common / Uncommon / Rare / Very Rare / Legendary / Artifact / Varies',
    ),
});

/** Extra damage a magic weapon deals on a hit (Flame Tongue, Vicious Weapon). */
const ExtraDamageSchema = z.strictObject({
  dice: z.string().describe("extra damage dice on a hit, e.g. '2d6'"),
  damage_type: APIReferenceSchema.optional().describe(
    "damage-types ref for the extra damage; OMIT when it matches the base weapon's own damage type (Vicious Weapon: 'same type as the weapon')",
  ),
});

/**
 * Structured combat effect for magic items that modify a base weapon, ammunition,
 * armor, or shield the wielder picks. Captures only the numeric effects the text
 * states (bonuses, extra damage, the +1/+2/+3 rarity scaling); everything else
 * (resistances, set-AC, flavor) stays in `desc`. Omit for purely descriptive items.
 */
const CombatSchema = z.strictObject({
  applies_to: z
    .enum(['weapon', 'ammunition', 'armor', 'shield'])
    .describe('the kind of base item this magic item attaches to / modifies'),
  attack_bonus: z
    .number()
    .optional()
    .describe(
      "flat bonus to attack rolls with the base weapon (set for named items like Dragon Slayer's +1); omit when none or when scales_with_rarity",
    ),
  damage_bonus: z
    .number()
    .optional()
    .describe(
      "flat bonus to damage rolls; for '+X to attack and damage rolls' set attack_bonus AND damage_bonus to X; omit when none or scales_with_rarity",
    ),
  ac_bonus: z
    .number()
    .optional()
    .describe(
      'flat bonus to Armor Class while worn (armor) or held (shield); omit when none or scales_with_rarity',
    ),
  scales_with_rarity: z
    .boolean()
    .optional()
    .describe(
      "true ONLY for the generic 'Weapon/Armor/Shield/Ammunition, +1, +2, or +3' items, whose bonus equals the chosen +N (attack & damage for weapons/ammunition, AC for armor/shields) and whose rarity is 'Varies'. Do not also set the flat *_bonus fields.",
    ),
  extra_damage: z
    .array(ExtraDamageSchema)
    .optional()
    .describe(
      'extra damage dealt on a hit (Flame Tongue: +2d6 Fire; Vicious Weapon: +2d6 of the weapon type)',
    ),
});

export const MagicItemSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'bag-of-holding'"),
  name: z.string(),
  equipment_category: APIReferenceSchema.describe(
    'one equipment-categories ref: armor/weapons/potions/rings/wands/staffs/scrolls/wondrous-items',
  ),
  rarity: RaritySchema,
  attunement: z.boolean().describe('true if the item Requires Attunement'),
  desc: z.string().describe('body paragraphs joined with blank lines'),
  variant: z.boolean().describe('true if this item is a variant of another'),
  variants: z
    .array(APIReferenceSchema)
    .describe(
      'magic-items refs for sub-variants on their own pages; usually []',
    ),
  'limited-to': z.string().optional().describe('e.g. a class restriction'),
  combat: CombatSchema.optional().describe(
    'structured combat effect for magic weapons/ammunition/armor/shields that modify a base item; omit for purely descriptive items',
  ),
  image: z.string().optional(),
  url: z.string().describe('/api/2024/magic-items/<index>'),
});

export type MagicItem = z.infer<typeof MagicItemSchema>;
