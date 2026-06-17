import * as z from 'zod/v4';

/**
 * 2024-edition Poison schema.
 *
 * The 14 PHB poisons, extracted from the wiki's `equipment:poison` table page
 * (one record per row) — see `prompts/poison-extraction.md`. A distinct entity
 * type rather than equipment because each carries a delivery `type` and a save-
 * based effect.
 *
 * Modeled on `node_modules/5e-database/src/2024/schemas/5e-SRD-Poisons.ts`, with
 * `cost` expressed as `{ quantity, unit }` to match `equipment-2024.ts` (rather
 * than 5e-database's bare number), and `desc` as paragraphs.
 */
const CostSchema = z.strictObject({
  quantity: z.number(),
  unit: z.enum(['cp', 'sp', 'ep', 'gp', 'pp']),
});

export const PoisonSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'assassins-blood'"),
  name: z.string(),
  type: z
    .enum(['ingested', 'inhaled', 'contact', 'injury'])
    .describe('delivery method, lowercased ("Ingested Poison" -> "ingested")'),
  cost: CostSchema,
  desc: z.array(z.string()).describe('effect paragraphs'),
  url: z.string().describe('/api/2024/poisons/<index>'),
});

export type Poison = z.infer<typeof PoisonSchema>;
