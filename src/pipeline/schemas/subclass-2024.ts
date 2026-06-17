import * as z from 'zod/v4';

/**
 * 2024-edition Subclass schema (2014-compatible structure).
 *
 * Features are NOT embedded — they're separate Feature entities.
 * Subclass-level progression is accessed via `subclass_levels` URL.
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

/** Spells gained from a subclass (e.g., domain spells, oath spells). */
export const SubclassSpellSchema = z.strictObject({
  prerequisites: z.array(
    z.strictObject({
      index: z.string(),
      type: z.string(),
      name: z.string().optional(),
      url: z.string().optional(),
    }),
  ),
  spell: APIReferenceSchema,
});

export const SubclassSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'college-of-glamour'"),
  class: APIReferenceSchema.describe('reference to parent class'),
  name: z.string().describe("display name, e.g. 'College of Glamour'"),
  subclass_flavor: z
    .string()
    .describe("category name, e.g. 'Bard College', 'Primal Path'"),
  desc: z.array(z.string()).describe('intro paragraphs before feature list'),
  subclass_levels: z
    .string()
    .describe(
      'URL to level progression, e.g. /api/2024/subclasses/<index>/levels',
    ),
  spells: z
    .array(SubclassSpellSchema)
    .optional()
    .describe('expanded spell list if present'),
  url: z.string().describe('/api/2024/subclasses/<index>'),
});

export type Subclass = z.infer<typeof SubclassSchema>;
