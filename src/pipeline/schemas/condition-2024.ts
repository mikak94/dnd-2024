import * as z from 'zod/v4';

/**
 * 2024-edition Condition schema.
 *
 * The 15 PHB conditions (Blinded, Charmed, … Unconscious). Not crawlable — the
 * wiki hosts no rules-glossary pages — so, like proficiencies, these are *derived*
 * from the canonical 5e-database 2024 condition list (see `conditions.ts`) and
 * assembled by `npm run validate condition`.
 *
 * Modeled on `node_modules/5e-database/src/2024/schemas/5e-SRD-Conditions.ts`,
 * with the single `description` string split into `desc` paragraphs to match this
 * project's prose convention (spells/features/backgrounds use `desc: string[]`).
 */
export const ConditionSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'blinded'"),
  name: z.string(),
  desc: z
    .array(z.string())
    .describe('effect paragraphs; the leading bold label kept inline'),
  url: z.string().describe('/api/2024/conditions/<index>'),
});

export type Condition = z.infer<typeof ConditionSchema>;
