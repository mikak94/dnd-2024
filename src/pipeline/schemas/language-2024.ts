import * as z from 'zod/v4';

/**
 * 2024-edition Language schema.
 *
 * The 19 PHB languages (Common, Elvish, … plus the rare ones). Not crawlable —
 * the wiki hosts no languages page — so, like proficiencies, these are *derived*
 * from the canonical 5e-database 2024 language list (see `languages.ts`) and
 * assembled by `npm run validate language`.
 *
 * Mirrors `node_modules/5e-database/src/2024/schemas/5e-SRD-Languages.ts`
 * (2024 dropped 2014's `type`/`typical_speakers`/`script` in favor of `is_rare`).
 */
export const LanguageSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'elvish', 'thieves-cant'"),
  name: z.string(),
  is_rare: z.boolean().describe('Rare languages vs Standard'),
  note: z.string().describe('optional note; empty string when none'),
  url: z.string().describe('/api/2024/languages/<index>'),
});

export type Language = z.infer<typeof LanguageSchema>;
