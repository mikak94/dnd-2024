import * as z from 'zod/v4';

/**
 * 2024-edition Proficiency schema.
 *
 * Our authoritative 2024 proficiency reference set, used to validate the
 * `starting_proficiencies` of backgrounds, feat prerequisites, and trait grants.
 * Built (see `proficiencies.ts`) from the canonical 5e-database 2024 proficiency
 * list — so indexes match 5e-database exactly (`cartographers-tools`, not
 * `tool-cartographers-tools`) — plus the PHB category proficiencies 2024
 * backgrounds grant by choice (`artisans-tools`, `gaming-set`, `musical-instrument`).
 *
 * `url` is normalized to the project convention `/api/2024/proficiencies/<index>`
 * (5e-database keeps a stray `tool-` prefix in some of its proficiency URLs; we don't).
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

export const ProficiencySchema = z.strictObject({
  index: z
    .string()
    .describe("kebab-case slug, e.g. 'skill-acrobatics', 'smiths-tools'"),
  name: z.string(),
  type: z
    .string()
    .describe(
      "grouping, e.g. 'Skills', \"Artisan's Tools\", 'Tools', 'Musical Instruments', 'Saving Throws', 'Armor', 'Weapons', 'Other'",
    ),
  reference: APIReferenceSchema.optional().describe(
    'the underlying skill / equipment / ability-score this proficiency is for; omitted for category proficiencies',
  ),
  url: z.string().describe('/api/2024/proficiencies/<index>'),
});

export type Proficiency = z.infer<typeof ProficiencySchema>;
