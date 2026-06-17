import * as z from 'zod/v4';
import { ChoiceSchema } from './common-2024.ts';

/**
 * 2024-edition Species schema (2014 race base, renamed).
 *
 * 2024 moved ability bonuses to backgrounds and dropped species alignment and
 * direct language grants, so those 2014 fields are omitted. `type` (creature type,
 * e.g. "Humanoid") is 2024-only. Some species pick size from a choice, so exactly
 * one of `size` / `size_options` is present. Traits are separate Trait entities.
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

export const SpeciesSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'dragonborn'"),
  name: z.string(),
  size: z
    .string()
    .optional()
    .describe("e.g. 'Medium'; absent when size is a choice"),
  size_options: ChoiceSchema.optional().describe('e.g. choose Small or Medium'),
  size_description: z.string().optional(),
  speed: z.number().describe('walking speed in feet'),
  type: z.string().describe("creature type, e.g. 'Humanoid'"),
  age: z.string().optional(),
  traits: z
    .array(APIReferenceSchema)
    .describe('refs to separate Trait entities'),
  subspecies: z
    .array(APIReferenceSchema)
    .describe('refs to Subspecies entities'),
  url: z.string().describe('/api/2024/species/<index>'),
});

export type Species = z.infer<typeof SpeciesSchema>;
