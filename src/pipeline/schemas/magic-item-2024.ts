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

export const MagicItemSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'bag-of-holding'"),
  name: z.string(),
  equipment_category: APIReferenceSchema.describe(
    'one equipment-categories ref: armor/weapons/potions/rings/wands/staffs/wondrous-items',
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
  image: z.string().optional(),
  url: z.string().describe('/api/2024/magic-items/<index>'),
});

export type MagicItem = z.infer<typeof MagicItemSchema>;
