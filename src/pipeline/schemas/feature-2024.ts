import * as z from 'zod/v4';
import { ChoiceSchema } from './common-2024.ts';

/**
 * 2024-edition Feature schema (2014-compatible structure).
 *
 * Features are separate entities, can belong to a class OR subclass.
 * Eldritch Invocations/Metamagic use `parent` to link to main feature.
 */
export const APIReferenceSchema = z.strictObject({
  index: z.string(),
  name: z.string(),
  url: z.string(),
});

/** Prerequisites for a feature (level, other feature, pact, etc.). */
export const FeaturePrerequisiteSchema = z.strictObject({
  type: z.enum(['level', 'feature', 'spell', 'proficiency']),
  level: z.number().optional(),
  feature: z.string().optional(),
  spell: z.string().optional(),
  proficiency: z.string().optional(),
});

/**
 * How a feature is activated. Omit for passive/always-on features.
 *
 * `action_type` — the action type required:
 *   - "action" / "bonus_action" / "reaction" — standard action economy
 *   - "free_action" — no action cost (e.g. "you can do X as part of another action")
 *   - "special" — unique cost described only in desc (e.g. "when you roll initiative")
 *
 * `cost` — resource expended on top of the action type; omit for free activation.
 * Use these canonical tokens (all others go in desc):
 *   "bardic_inspiration" | "channel_divinity" | "focus_point" | "psionic_energy" |
 *   "rage" | "sorcery_point" | "spell_slot" | "superiority_die" | "wild_shape"
 */
export const FeatureActivationSchema = z.strictObject({
  action_type: z.enum([
    'action',
    'bonus_action',
    'reaction',
    'free_action',
    'special',
  ]),
  cost: z
    .enum([
      'bardic_inspiration',
      'channel_divinity',
      'focus_point',
      'psionic_energy',
      'rage',
      'sorcery_point',
      'spell_slot',
      'superiority_die',
      'wild_shape',
    ])
    .optional()
    .describe(
      'resource expended on activation; omit when the action type alone is the cost',
    ),
});

/**
 * When a feature's uses reset. Omit for unlimited-use features (no stated cap).
 *
 * `condition` — what triggers the recharge:
 *   - "short_rest" | "long_rest" | "short_or_long_rest" | "dawn" | "turn"
 *
 * `uses` — fixed number of uses per recharge window (1 for "once", 2 for "twice", etc.).
 * Omit when the count is variable (a proficiency bonus, ability modifier, etc.) — leave
 * that detail in `desc`.
 */
export const FeatureRechargeSchema = z.strictObject({
  condition: z.enum([
    'short_rest',
    'long_rest',
    'short_or_long_rest',
    'dawn',
    'turn',
  ]),
  uses: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'fixed uses per recharge; omit when count is variable (stays in desc)',
    ),
});

/**
 * One spell a feature lets you cast outside your normal spellcasting — the 2024
 * "free spellcasting" features: an Eldritch Invocation (Armor of Shadows → cast
 * Mage Armor without a slot) or a subclass grant (Great Old One's Eldritch Hex →
 * always have Hex prepared). The exact rules text stays in `desc`; this is the
 * machine-readable grant so a character builder can surface the spell.
 */
export const FeatureSpellGrantSchema = z.strictObject({
  spell: APIReferenceSchema.describe(
    'the granted spell, referencing the real spell entity',
  ),
  usage: z
    .enum(['at_will', 'per_long_rest', 'always_prepared'])
    .describe(
      'how the feature lets you cast it: at_will = cast without a spell slot any number of ' +
        'times; per_long_rest = a limited number of free (slotless) casts per Long Rest (see ' +
        '`times`); always_prepared = the spell is always prepared and cast with normal spell slots',
    ),
  times: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe(
      'free casts per Long Rest when usage is per_long_rest (e.g. Water Breathing: 1)',
    ),
  self_only: z
    .boolean()
    .optional()
    .describe(
      'true when the free cast may target only yourself (Armor of Shadows, Ascendant Step)',
    ),
  casting_time_override: z
    .enum(['action', 'bonus_action', 'reaction'])
    .optional()
    .describe(
      'present when the feature explicitly casts this spell with a different action type than the ' +
        "spell's own casting_time (e.g. an invocation that lets you cast an Action spell as a " +
        "Bonus Action). For benefit_options spells the override is the feature's activation.action_type — " +
        'do not also set this field there.',
    ),
});

/**
 * Spells a feature confers the ability to cast. Present only when the feature
 * grants specific, named spells; a "choose a spell to learn" pick or a
 * conditional "when you cast a [school] spell" rider is NOT modeled here.
 */
export const FeatureSpellcastingSchema = z.strictObject({
  ability: APIReferenceSchema.optional().describe(
    "the spellcasting ability for these spells; omit to use the granting class's own " +
      "spellcasting ability (the usual case — an invocation uses the Warlock's Charisma)",
  ),
  spells: z
    .array(FeatureSpellGrantSchema)
    .min(1)
    .describe(
      'the specific spells the feature grants, each with how it can be cast',
    ),
});

/**
 * One benefit in a "choose one of the following" feature (e.g. The Third Eye).
 *
 * `type: "passive"` — a fixed non-spell mechanical benefit (Darkvision, read any language, …).
 * `type: "spell"` — cast a named spell as part of this feature's activation. The casting
 *   time is the feature's `activation.action_type`, not the spell's own casting_time.
 */
export const FeatureBenefitSchema = z.union([
  z.strictObject({
    type: z.literal('passive'),
    name: z
      .string()
      .describe(
        'short label for the benefit (same as the bold heading in the text)',
      ),
    desc: z.string().describe('one-sentence description of the benefit'),
  }),
  z.strictObject({
    type: z.literal('spell'),
    name: z.string().describe('short label (usually the spell name)'),
    desc: z
      .string()
      .optional()
      .describe('one-sentence description if needed beyond the spell name'),
    spell: APIReferenceSchema.describe(
      'the spell cast as part of this benefit',
    ),
  }),
]);

/**
 * A "choose one of the following benefits" structure — for features like The Third Eye
 * that offer a menu of heterogeneous options (passive benefits and/or spell casts).
 * Present only when the feature explicitly offers such a pick; omit for standard features.
 */
export const FeatureBenefitOptionsSchema = z.strictObject({
  choose: z
    .number()
    .int()
    .min(1)
    .describe('number of benefits to choose (usually 1)'),
  benefits: z.array(FeatureBenefitSchema).min(2),
});

/** Feature-specific data for features with choosable options or granted spells. */
export const FeatureSpecificSchema = z.strictObject({
  subfeature_options: z
    .strictObject({
      choose: z.number(),
      type: z.string(),
      from: z.strictObject({
        option_set_type: z.string(),
        options: z.array(
          z.strictObject({
            option_type: z.string(),
            item: APIReferenceSchema,
          }),
        ),
      }),
    })
    .optional(),
  expertise_options: z
    .strictObject({
      choose: z.number(),
      type: z.string(),
      from: z.strictObject({
        option_set_type: z.string(),
        options: z.array(
          z.strictObject({
            option_type: z.literal('reference'),
            item: APIReferenceSchema,
          }),
        ),
      }),
    })
    .optional(),
  invocations: z.array(APIReferenceSchema).optional(),
  spellcasting: FeatureSpellcastingSchema.optional(),
  benefit_options: FeatureBenefitOptionsSchema.optional().describe(
    'for "choose one of the following benefits" features (e.g. The Third Eye)',
  ),
});

export const FeatureSchema = z.strictObject({
  index: z.string().describe('unique slug: <subclass>-<level>-<feature-name>'),
  name: z.string(),
  level: z.number().int().min(1).max(20),
  class: APIReferenceSchema.optional().describe('parent class reference'),
  subclass: APIReferenceSchema.optional().describe('parent subclass reference'),
  parent: APIReferenceSchema.optional().describe(
    'for invocations/metamagic: main feature ref',
  ),
  desc: z.array(z.string()).describe('feature description paragraphs'),
  prerequisites: z.array(FeaturePrerequisiteSchema).describe('empty if none'),
  repeatable: z
    .boolean()
    .optional()
    .describe(
      'true if the feature is Repeatable ("You can gain this invocation more than once") — ' +
        'so a builder may grant it multiple times; omit otherwise',
    ),
  choices: z
    .array(ChoiceSchema)
    .optional()
    .describe(
      'in-feature player picks captured as the shared recursive ChoiceSchema (mirrors ' +
        'Feat.choices) — e.g. an invocation\'s "choose one of your known Warlock cantrips that …" ' +
        '(a spells choice with `spell_source`) or "choose an Origin feat" (a feats resource_list). ' +
        'Omit if the feature has none. Distinct from feature_specific.subfeature_options/' +
        'expertise_options, which model closed enumerated entity sets (Fighting Style / Expertise / ' +
        'Weapon Mastery).',
    ),
  activation: FeatureActivationSchema.optional().describe(
    'how to activate this feature; omit for passive/always-on features',
  ),
  recharge: FeatureRechargeSchema.optional().describe(
    'when uses reset; omit for unlimited-use or per-activation-cost-only features',
  ),
  feature_specific: FeatureSpecificSchema.optional().describe(
    'for features with options',
  ),
  url: z.string().describe('/api/2024/features/<index>'),
});

export type Feature = z.infer<typeof FeatureSchema>;
