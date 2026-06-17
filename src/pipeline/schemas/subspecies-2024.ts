import * as z from 'zod/v4';

/**
 * 2024-edition Subspecies schema (2014 subrace base, renamed).
 *
 * 2024 dropped subrace ability bonuses (ASIs moved to backgrounds). `desc` is
 * normalized to a string[] (the 2014 subrace used a bare string). `traits` are
 * refs to separate Trait entities; `species` is the parent species ref.
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

export const SubspeciesSchema = z.strictObject({
  index: z.string().describe("kebab-case slug, e.g. 'high-elf'"),
  name: z.string(),
  species: APIReferenceSchema.describe('parent species ref'),
  desc: z.array(z.string()),
  traits: z
    .array(APIReferenceSchema)
    .describe('refs to separate Trait entities'),
  url: z.string().describe('/api/2024/subspecies/<index>'),
});

export type Subspecies = z.infer<typeof SubspeciesSchema>;
