import * as fs from 'node:fs/promises';
import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import type { z } from 'zod/v4';
import { DATA, ROOT } from './config.ts';
import { SpellSchema, type Spell } from './schemas/spell-2024.ts';
import { ClassSchema, type Class } from './schemas/class-2024.ts';
import { SubclassSchema, type Subclass } from './schemas/subclass-2024.ts';
import { FeatureSchema, type Feature } from './schemas/feature-2024.ts';
import { LevelSchema, type Level } from './schemas/level-2024.ts';
import { FeatSchema, type Feat } from './schemas/feat-2024.ts';
import {
  BackgroundSchema,
  type Background,
} from './schemas/background-2024.ts';
import { SpeciesSchema, type Species } from './schemas/species-2024.ts';
import {
  SubspeciesSchema,
  type Subspecies,
} from './schemas/subspecies-2024.ts';
import { TraitSchema, type Trait } from './schemas/trait-2024.ts';
import {
  ProficiencySchema,
  type Proficiency,
} from './schemas/proficiency-2024.ts';
import { EquipmentSchema, type Equipment } from './schemas/equipment-2024.ts';
import { MagicItemSchema, type MagicItem } from './schemas/magic-item-2024.ts';
import { ConditionSchema, type Condition } from './schemas/condition-2024.ts';
import { LanguageSchema, type Language } from './schemas/language-2024.ts';
import { PoisonSchema, type Poison } from './schemas/poison-2024.ts';

/** Indexes that exist in the shipped 2024 data — used for referential-integrity checks. */
function shippedIndexes(file: string): Set<string> {
  const p = path.join(
    ROOT,
    'node_modules',
    '5e-database',
    'src',
    '2024',
    'en',
    file,
  );
  const data = JSON.parse(readFileSync(p, 'utf8')) as { index: string }[];
  return new Set(data.map((d) => d.index));
}
const SHIPPED_SCHOOLS = shippedIndexes('5e-SRD-Magic-Schools.json');
const SHIPPED_CLASSES = shippedIndexes('5e-SRD-Classes.json');
const SHIPPED_DAMAGE_TYPES = shippedIndexes('5e-SRD-Damage-Types.json');
const SHIPPED_ABILITIES = shippedIndexes('5e-SRD-Ability-Scores.json');
const SHIPPED_SKILLS = shippedIndexes('5e-SRD-Skills.json');
// Closed taxonomies that equipment/magic-item refs point at. We crawl the items
// but their category/property/mastery refs are validated against these canonical
// 5e-database lists (same idea as spells validating school/damage-type refs).
const SHIPPED_EQUIPMENT_CATEGORIES = shippedIndexes(
  '5e-SRD-Equipment-Categories.json',
);
// The 2024 wiki's equipment:mounts-and-vehicles page groups items under categories
// 5e-database's equipment taxonomy omits entirely (it ships no mounts/vehicles). We
// coin these intentionally — same spirit as proficiencies.ts adding the PHB category
// proficiencies 5e-database lacks. Kept in sync with referential-integrity.test.ts.
const EXTRA_EQUIPMENT_CATEGORIES = new Set([
  'mounts-and-vehicles',
  'mounts-and-other-animals',
  'tack-harness-and-drawn-vehicles',
  'waterborne-vehicles',
  // 5e-database lumps Scrolls under wondrous items; we split them out so consumable
  // scrolls are distinguishable from worn wondrous items (Scroll → `scrolls`).
  'scrolls',
]);
const EQUIPMENT_CATEGORIES = new Set([
  ...SHIPPED_EQUIPMENT_CATEGORIES,
  ...EXTRA_EQUIPMENT_CATEGORIES,
]);
const SHIPPED_WEAPON_PROPERTIES = shippedIndexes(
  '5e-SRD-Weapon-Properties.json',
);
const SHIPPED_WEAPON_MASTERY = shippedIndexes(
  '5e-SRD-Weapon-Mastery-Properties.json',
);
const RARITIES = new Set([
  'Common',
  'Uncommon',
  'Rare',
  'Very Rare',
  'Legendary',
  'Artifact',
  'Varies',
]);

/**
 * Indexes from an assembled `data/out/5e-SRD-*.json` we build ourselves, with a
 * fallback to the shipped 5e-database file so the pipeline can bootstrap before
 * the category has been assembled. Used for our authoritative proficiency set.
 */
function ourIndexes(outputFile: string, shippedFallback: string): Set<string> {
  try {
    const data = JSON.parse(
      readFileSync(path.join(DATA.out, outputFile), 'utf8'),
    ) as { index: string }[];
    return new Set(data.map((d) => d.index));
  } catch {
    return shippedIndexes(shippedFallback);
  }
}
// Our authoritative 2024 proficiency set (built by `npm run proficiencies` +
// `npm run validate proficiency`). Falls back to the sparse shipped set until built.
const PROFICIENCIES = ourIndexes(
  '5e-SRD-Proficiencies.json',
  '5e-SRD-Proficiencies.json',
);
// Our authoritative 2024 base-equipment set (built by crawling + extracting, then
// `npm run validate equipment`). Used for pack `contents` and magic-item `variants`
// self-refs; falls back to the shipped list until assembled.
const EQUIPMENT = ourIndexes('5e-SRD-Equipment.json', '5e-SRD-Equipment.json');
const MAGIC_ITEMS = ourIndexes(
  '5e-SRD-Magic-Items.json',
  '5e-SRD-Magic-Items.json',
);
// Our assembled feats — feature_specific (Fighting Style) options reference the
// `fighting-style` feats. Falls back to the shipped list until assembled.
const FEATS = ourIndexes('5e-SRD-Feats.json', '5e-SRD-Feats.json');
// Our assembled spells — a feat's spell_source.also_spells references them by index
// (Boon of Siberys's Dragonmark table). Falls back to the shipped list until built.
const SPELLS = ourIndexes('5e-SRD-Spells.json', '5e-SRD-Spells.json');

interface Report {
  slug: string;
  errors: string[];
  warnings: string[];
}

type Entity =
  | Spell
  | Class
  | Subclass
  | Feature
  | Level
  | Feat
  | Background
  | Species
  | Subspecies
  | Trait
  | Proficiency
  | Equipment
  | MagicItem
  | Condition
  | Language
  | Poison;

interface CategoryConfig {
  schema: z.ZodSchema;
  folder: string;
  output: string;
  checkRefs: (entity: Entity) => Pick<Report, 'errors' | 'warnings'>;
  /**
   * Optional assembly-time transform applied to each valid record before it's
   * written to the aggregated `5e-SRD-*.json`. Return a (possibly modified) record
   * to keep it, or `null` to drop it from the assembled output. Per-item files in
   * `data/out/<folder>/` are left untouched (they stay faithful to extraction).
   */
  transform?: (entity: Entity) => Entity | null;
}

/**
 * Strip the non-PHB Artificer class from a spell's class list at assembly time.
 * The wiki lists Artificer on ~80 spells, but we build only the 12 PHB classes, so
 * the aggregated dataset is kept PHB-only. A spell whose *only* class is Artificer
 * (e.g. Homunculus Servant) has no PHB caster and is dropped entirely (return null).
 */
function stripArtificer(spell: Spell): Spell | null {
  const classes = spell.classes.filter((c) => c.index !== 'artificer');
  if (classes.length === 0) return null;
  return { ...spell, classes };
}

/** Species indexes that have at least one subspecies (their lineage IS a subspecies). */
const SPECIES_WITH_SUBSPECIES: Set<string> = (() => {
  const set = new Set<string>();
  const dir = path.join(DATA.out, 'species');
  try {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      const sp = JSON.parse(readFileSync(path.join(dir, f), 'utf8')) as Species;
      if ((sp.subspecies?.length ?? 0) > 0) set.add(sp.index);
    }
  } catch {
    /* species not extracted yet — nothing to normalize against */
  }
  return set;
})();

/**
 * Elf, Gnome, and Tiefling express their lineage BOTH as subspecies AND as a
 * species-level trait carrying `subtrait_options` (e.g. Fiendish Legacy). The
 * subspecies IS the choice, so the duplicate `subtrait_options` is redundant and
 * makes a builder ask for the same pick twice. Drop it at assembly time, keeping
 * the trait's descriptive text. Dragonborn/Goliath/Shifter keep theirs — they
 * have no subspecies, so the in-trait choice is the only way to pick the variant.
 */
function stripRedundantLineageChoice(trait: Trait): Trait {
  if (!trait.trait_specific?.subtrait_options) return trait;
  const isLineageWithSubspecies = trait.species.some((s) =>
    SPECIES_WITH_SUBSPECIES.has(s.index),
  );
  if (!isLineageWithSubspecies) return trait;
  const { subtrait_options: _drop, ...rest } = trait.trait_specific;
  const trait_specific = Object.keys(rest).length ? rest : undefined;
  return { ...trait, trait_specific };
}

function checkSpellRefs(spell: Spell): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!SHIPPED_SCHOOLS.has(spell.school.index)) {
    errors.push(`unknown school index '${spell.school.index}'`);
  }
  for (const c of spell.classes) {
    // Artificer isn't a PHB class; we strip it from class lists during assembly
    // (see stripArtificer), so it's expected here and not worth warning on.
    if (c.index === 'artificer') continue;
    if (!SHIPPED_CLASSES.has(c.index)) {
      warnings.push(`class '${c.index}' not in shipped 2024 classes`);
    }
  }
  if (spell.url !== `/api/2024/spells/${spell.index}`) {
    errors.push(`url/index mismatch: ${spell.url} vs index ${spell.index}`);
  }
  const dt = spell.damage?.damage_type;
  if (dt && !SHIPPED_DAMAGE_TYPES.has(dt.index)) {
    errors.push(`unknown damage_type index '${dt.index}'`);
  }
  if (spell.dc && !SHIPPED_ABILITIES.has(spell.dc.dc_type.index)) {
    errors.push(`unknown dc_type index '${spell.dc.dc_type.index}'`);
  }
  return { errors, warnings };
}

function checkClassRefs(cls: Class): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (cls.url !== `/api/2024/classes/${cls.index}`) {
    errors.push(`url/index mismatch: ${cls.url} vs index ${cls.index}`);
  }
  for (const st of cls.saving_throws) {
    if (!SHIPPED_ABILITIES.has(st.index)) {
      errors.push(`unknown saving throw ability '${st.index}'`);
    }
  }
  return { errors, warnings };
}

function checkSubclassRefs(
  subclass: Subclass,
): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!SHIPPED_CLASSES.has(subclass.class.index)) {
    errors.push(`unknown class index '${subclass.class.index}'`);
  }
  if (subclass.url !== `/api/2024/subclasses/${subclass.index}`) {
    errors.push(
      `url/index mismatch: ${subclass.url} vs index ${subclass.index}`,
    );
  }
  if (
    subclass.subclass_levels !== `/api/2024/subclasses/${subclass.index}/levels`
  ) {
    errors.push(`subclass_levels URL mismatch`);
  }
  return { errors, warnings };
}

/**
 * Validate one `feature_specific` option ref against the dataset its URL points at
 * (the whole-dataset integrity test is the real gate; this just yields a per-record
 * error at validate time). Recognized segments: feats / equipment / proficiencies / skills.
 */
function checkFeatureOptionRef(
  ref: { index: string; url: string },
  errors: string[],
): void {
  const seg = ref.url.match(/\/api\/2024\/([^/]+)\//)?.[1];
  const sets: Record<string, Set<string>> = {
    feats: FEATS,
    equipment: EQUIPMENT,
    proficiencies: PROFICIENCIES,
    skills: SHIPPED_SKILLS,
  };
  const set = seg ? sets[seg] : undefined;
  if (set && !set.has(ref.index)) {
    errors.push(`feature_specific option '${ref.index}' not in ${seg} set`);
  }
}

function checkFeatureRefs(
  feature: Feature,
): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (feature.level < 1 || feature.level > 20) {
    errors.push(`level ${feature.level} out of range 1-20`);
  }
  if (feature.class && !SHIPPED_CLASSES.has(feature.class.index)) {
    errors.push(`unknown class index '${feature.class.index}'`);
  }
  if (feature.url !== `/api/2024/features/${feature.index}`) {
    errors.push(`url/index mismatch: ${feature.url} vs index ${feature.index}`);
  }
  // Validate the option refs we coin in feature_specific (Fighting Style feats,
  // Expertise skill proficiencies, Weapon Mastery weapons) resolve against their sets.
  const fs = feature.feature_specific;
  for (const block of [fs?.subfeature_options, fs?.expertise_options]) {
    for (const opt of block?.from.options ?? []) {
      const item = (opt as { item?: { index?: unknown; url?: unknown } })?.item;
      if (
        item &&
        typeof item.index === 'string' &&
        typeof item.url === 'string'
      ) {
        checkFeatureOptionRef({ index: item.index, url: item.url }, errors);
      }
    }
  }
  // Validate the shared `choices` (mirrors checkFeatRefs): options_array item refs
  // resolve against their sets, and a spells-type `spell_source` names real classes/
  // schools/spells. resource_list `from`s carry only a URL string, so nothing to check.
  for (const choice of feature.choices ?? []) {
    const from = choice.from as {
      option_set_type?: string;
      options?: unknown[];
    };
    if (from?.option_set_type === 'options_array') {
      for (const opt of from.options ?? []) {
        const item = (opt as { item?: { index?: unknown; url?: unknown } })
          ?.item;
        if (
          item &&
          typeof item.index === 'string' &&
          typeof item.url === 'string'
        ) {
          checkFeatureOptionRef({ index: item.index, url: item.url }, errors);
        }
      }
    }
    const ss = (
      choice as {
        spell_source?: {
          classes?: string[];
          schools?: string[];
          also_spells?: string[];
        };
      }
    ).spell_source;
    if (!ss) continue;
    for (const c of ss.classes ?? []) {
      if (!SHIPPED_CLASSES.has(c)) {
        errors.push(`unknown spell_source class '${c}'`);
      }
    }
    for (const sc of ss.schools ?? []) {
      if (!SHIPPED_SCHOOLS.has(sc)) {
        errors.push(`unknown spell_source school '${sc}'`);
      }
    }
    for (const sp of ss.also_spells ?? []) {
      if (!SPELLS.has(sp)) {
        errors.push(`unknown spell_source also_spells spell '${sp}'`);
      }
    }
  }
  return { errors, warnings };
}

function checkLevelRefs(level: Level): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (level.level < 1 || level.level > 20) {
    errors.push(`level ${level.level} out of range 1-20`);
  }
  if (!SHIPPED_CLASSES.has(level.class.index)) {
    errors.push(`unknown class index '${level.class.index}'`);
  }
  return { errors, warnings };
}

/**
 * Validate one feat-`choices` option ref against the set its URL segment names.
 * Closed SRD taxonomies (abilities/damage-types/classes/skills) are errors; the
 * open proficiency set is a warning (same convention as the prereq check below).
 * `resource_list` `from`s carry a `resource_list_url` string (not an `{index,url}`
 * ref), so they're never reached here.
 */
function checkChoiceOptionRef(
  ref: { index: string; url: string },
  errors: string[],
  warnings: string[],
): void {
  const seg = ref.url.match(/\/api\/2024\/([^/]+)\//)?.[1];
  const errSets: Record<string, Set<string>> = {
    'ability-scores': SHIPPED_ABILITIES,
    'damage-types': SHIPPED_DAMAGE_TYPES,
    classes: SHIPPED_CLASSES,
    skills: SHIPPED_SKILLS,
  };
  if (seg && errSets[seg] && !errSets[seg].has(ref.index)) {
    errors.push(`choice option '${ref.index}' not in ${seg} set`);
  } else if (seg === 'proficiencies' && !PROFICIENCIES.has(ref.index)) {
    warnings.push(
      `choice option proficiency '${ref.index}' not in 2024 proficiencies dataset`,
    );
  }
}

function checkFeatRefs(feat: Feat): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (feat.url !== `/api/2024/feats/${feat.index}`) {
    errors.push(`url/index mismatch: ${feat.url} vs index ${feat.index}`);
  }
  for (const p of feat.prerequisites) {
    if (p.ability_score && !SHIPPED_ABILITIES.has(p.ability_score.index)) {
      errors.push(`unknown ability_score index '${p.ability_score.index}'`);
    }
    if (p.proficiency && !PROFICIENCIES.has(p.proficiency.index)) {
      warnings.push(
        `proficiency '${p.proficiency.index}' not in 2024 proficiencies dataset`,
      );
    }
  }
  for (const ab of feat.ability_bonuses ?? []) {
    if (!SHIPPED_ABILITIES.has(ab.ability_score.index)) {
      errors.push(`unknown ability_bonus ability '${ab.ability_score.index}'`);
    }
  }
  // Validate option refs inside each structured choice resolve (the whole-dataset
  // integrity test is the real gate; this gives a per-record error at validate time).
  for (const choice of feat.choices ?? []) {
    const from = choice.from as {
      option_set_type?: string;
      options?: unknown[];
    };
    if (from?.option_set_type !== 'options_array') continue;
    for (const opt of from.options ?? []) {
      const item = (opt as { item?: { index?: unknown; url?: unknown } })?.item;
      if (
        item &&
        typeof item.index === 'string' &&
        typeof item.url === 'string'
      ) {
        checkChoiceOptionRef(
          { index: item.index, url: item.url },
          errors,
          warnings,
        );
      }
    }
  }
  // A spells-type choice's structured `spell_source` references classes/schools/spells.
  for (const choice of feat.choices ?? []) {
    const ss = (
      choice as {
        spell_source?: {
          classes?: string[];
          schools?: string[];
          also_spells?: string[];
        };
      }
    ).spell_source;
    if (!ss) continue;
    for (const c of ss.classes ?? []) {
      if (!SHIPPED_CLASSES.has(c)) {
        errors.push(`unknown spell_source class '${c}'`);
      }
    }
    for (const sc of ss.schools ?? []) {
      if (!SHIPPED_SCHOOLS.has(sc)) {
        errors.push(`unknown spell_source school '${sc}'`);
      }
    }
    for (const sp of ss.also_spells ?? []) {
      if (!SPELLS.has(sp)) {
        errors.push(`unknown spell_source also_spells spell '${sp}'`);
      }
    }
  }
  return { errors, warnings };
}

function checkBackgroundRefs(
  bg: Background,
): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (bg.url !== `/api/2024/backgrounds/${bg.index}`) {
    errors.push(`url/index mismatch: ${bg.url} vs index ${bg.index}`);
  }
  for (const a of bg.ability_scores) {
    if (!SHIPPED_ABILITIES.has(a.index)) {
      errors.push(`unknown ability_score index '${a.index}'`);
    }
  }
  for (const p of bg.starting_proficiencies) {
    if (!PROFICIENCIES.has(p.index)) {
      warnings.push(
        `proficiency '${p.index}' not in 2024 proficiencies dataset`,
      );
    }
  }
  // feat is one of our own new categories — format-checked only.
  if (!bg.feat.url.startsWith('/api/2024/feats/')) {
    errors.push(`feat url not a /api/2024/feats/ ref: ${bg.feat.url}`);
  }
  return { errors, warnings };
}

function checkSpeciesRefs(sp: Species): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (sp.url !== `/api/2024/species/${sp.index}`) {
    errors.push(`url/index mismatch: ${sp.url} vs index ${sp.index}`);
  }
  if (!sp.size && !sp.size_options) {
    errors.push(`species has neither size nor size_options`);
  }
  // traits/subspecies are our own new categories — format-checked only.
  for (const t of sp.traits) {
    if (!t.url.startsWith('/api/2024/traits/')) {
      errors.push(`trait url not a /api/2024/traits/ ref: ${t.url}`);
    }
  }
  for (const s of sp.subspecies) {
    if (!s.url.startsWith('/api/2024/subspecies/')) {
      errors.push(`subspecies url not a /api/2024/subspecies/ ref: ${s.url}`);
    }
  }
  return { errors, warnings };
}

function checkSubspeciesRefs(
  sub: Subspecies,
): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (sub.url !== `/api/2024/subspecies/${sub.index}`) {
    errors.push(`url/index mismatch: ${sub.url} vs index ${sub.index}`);
  }
  // species/traits are our own new categories — format-checked only.
  if (!sub.species.url.startsWith('/api/2024/species/')) {
    errors.push(`species url not a /api/2024/species/ ref: ${sub.species.url}`);
  }
  for (const t of sub.traits) {
    if (!t.url.startsWith('/api/2024/traits/')) {
      errors.push(`trait url not a /api/2024/traits/ ref: ${t.url}`);
    }
  }
  return { errors, warnings };
}

function checkTraitRefs(trait: Trait): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (trait.url !== `/api/2024/traits/${trait.index}`) {
    errors.push(`url/index mismatch: ${trait.url} vs index ${trait.index}`);
  }
  for (const p of trait.proficiencies ?? []) {
    if (!PROFICIENCIES.has(p.index)) {
      warnings.push(
        `proficiency '${p.index}' not in 2024 proficiencies dataset`,
      );
    }
  }
  const dt = trait.trait_specific?.damage_type;
  if (dt && !SHIPPED_DAMAGE_TYPES.has(dt.index)) {
    warnings.push(`damage_type '${dt.index}' not in shipped 2024 damage types`);
  }
  // Innate spellcasting grants: ability refs, granted-spell refs, and any
  // swap-pool class refs must resolve to shipped data.
  const sc = trait.trait_specific?.spellcasting;
  if (sc) {
    for (const a of sc.ability) {
      if (!SHIPPED_ABILITIES.has(a.index)) {
        errors.push(`spellcasting ability '${a.index}' not a known ability score`);
      }
    }
    for (const g of sc.spells) {
      if (!SPELLS.has(g.spell.index)) {
        errors.push(`spellcasting grants unknown spell '${g.spell.index}'`);
      }
      for (const c of g.swappable_from ?? []) {
        if (!SHIPPED_CLASSES.has(c)) {
          errors.push(`spellcasting swappable_from unknown class '${c}'`);
        }
      }
    }
  }
  // species/subspecies back-refs are our own categories — format-checked only.
  for (const s of trait.species) {
    if (!s.url.startsWith('/api/2024/species/')) {
      errors.push(`species url not a /api/2024/species/ ref: ${s.url}`);
    }
  }
  return { errors, warnings };
}

function checkProficiencyRefs(
  prof: Proficiency,
): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (prof.url !== `/api/2024/proficiencies/${prof.index}`) {
    errors.push(`url/index mismatch: ${prof.url} vs index ${prof.index}`);
  }
  return { errors, warnings };
}

function checkEquipmentRefs(
  eq: Equipment,
): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (eq.url !== `/api/2024/equipment/${eq.index}`) {
    errors.push(`url/index mismatch: ${eq.url} vs index ${eq.index}`);
  }
  if (eq.equipment_categories.length === 0) {
    errors.push(`no equipment_categories`);
  }
  for (const c of eq.equipment_categories) {
    if (!EQUIPMENT_CATEGORIES.has(c.index)) {
      errors.push(`unknown equipment_category '${c.index}'`);
    }
  }
  for (const dmg of [eq.damage, eq.two_handed_damage]) {
    if (dmg && !SHIPPED_DAMAGE_TYPES.has(dmg.damage_type.index)) {
      errors.push(`unknown damage_type index '${dmg.damage_type.index}'`);
    }
  }
  for (const p of eq.properties ?? []) {
    if (!SHIPPED_WEAPON_PROPERTIES.has(p.index)) {
      errors.push(`unknown weapon property '${p.index}'`);
    }
  }
  if (eq.mastery && !SHIPPED_WEAPON_MASTERY.has(eq.mastery.index)) {
    errors.push(`unknown weapon mastery '${eq.mastery.index}'`);
  }
  if (eq.ability && !SHIPPED_ABILITIES.has(eq.ability.index)) {
    errors.push(`unknown ability index '${eq.ability.index}'`);
  }
  for (const c of eq.contents ?? []) {
    if (!EQUIPMENT.has(c.item.index)) {
      warnings.push(`pack content '${c.item.index}' not in equipment set`);
    }
  }
  return { errors, warnings };
}

function checkMagicItemRefs(
  item: MagicItem,
): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (item.url !== `/api/2024/magic-items/${item.index}`) {
    errors.push(`url/index mismatch: ${item.url} vs index ${item.index}`);
  }
  if (!EQUIPMENT_CATEGORIES.has(item.equipment_category.index)) {
    errors.push(
      `unknown equipment_category '${item.equipment_category.index}'`,
    );
  }
  if (!RARITIES.has(item.rarity.name)) {
    warnings.push(`unexpected rarity '${item.rarity.name}'`);
  }
  for (const v of item.variants) {
    if (!MAGIC_ITEMS.has(v.index)) {
      warnings.push(`variant '${v.index}' not in magic-items set`);
    }
  }
  for (const ed of item.combat?.extra_damage ?? []) {
    if (ed.damage_type && !SHIPPED_DAMAGE_TYPES.has(ed.damage_type.index)) {
      errors.push(`unknown combat extra_damage damage_type '${ed.damage_type.index}'`);
    }
  }
  return { errors, warnings };
}

function checkConditionRefs(c: Condition): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  if (c.url !== `/api/2024/conditions/${c.index}`) {
    errors.push(`url/index mismatch: ${c.url} vs index ${c.index}`);
  }
  if (c.desc.length === 0) errors.push('empty desc');
  return { errors, warnings: [] };
}

function checkLanguageRefs(l: Language): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  if (l.url !== `/api/2024/languages/${l.index}`) {
    errors.push(`url/index mismatch: ${l.url} vs index ${l.index}`);
  }
  return { errors, warnings: [] };
}

function checkPoisonRefs(p: Poison): Pick<Report, 'errors' | 'warnings'> {
  const errors: string[] = [];
  if (p.url !== `/api/2024/poisons/${p.index}`) {
    errors.push(`url/index mismatch: ${p.url} vs index ${p.index}`);
  }
  if (p.desc.length === 0) errors.push('empty desc');
  return { errors, warnings: [] };
}

const REGISTRY: Record<string, CategoryConfig> = {
  spell: {
    schema: SpellSchema,
    folder: 'spell',
    output: '5e-SRD-Spells.json',
    checkRefs: checkSpellRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
    transform: stripArtificer as (e: Entity) => Entity | null,
  },
  class: {
    schema: ClassSchema,
    folder: 'class',
    output: '5e-SRD-Classes.json',
    checkRefs: checkClassRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  subclass: {
    schema: SubclassSchema,
    folder: 'subclass',
    output: '5e-SRD-Subclasses.json',
    checkRefs: checkSubclassRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  feature: {
    schema: FeatureSchema,
    folder: 'feature',
    output: '5e-SRD-Features.json',
    checkRefs: checkFeatureRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  level: {
    schema: LevelSchema,
    folder: 'level',
    output: '5e-SRD-Levels.json',
    checkRefs: checkLevelRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  feat: {
    schema: FeatSchema,
    folder: 'feat',
    output: '5e-SRD-Feats.json',
    checkRefs: checkFeatRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  background: {
    schema: BackgroundSchema,
    folder: 'background',
    output: '5e-SRD-Backgrounds.json',
    checkRefs: checkBackgroundRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  species: {
    schema: SpeciesSchema,
    folder: 'species',
    output: '5e-SRD-Species.json',
    checkRefs: checkSpeciesRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  subspecies: {
    schema: SubspeciesSchema,
    folder: 'subspecies',
    output: '5e-SRD-Subspecies.json',
    checkRefs: checkSubspeciesRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  trait: {
    schema: TraitSchema,
    folder: 'trait',
    output: '5e-SRD-Traits.json',
    checkRefs: checkTraitRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
    transform: stripRedundantLineageChoice as (e: Entity) => Entity | null,
  },
  proficiency: {
    schema: ProficiencySchema,
    folder: 'proficiency',
    output: '5e-SRD-Proficiencies.json',
    checkRefs: checkProficiencyRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  equipment: {
    schema: EquipmentSchema,
    folder: 'equipment',
    output: '5e-SRD-Equipment.json',
    checkRefs: checkEquipmentRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  'magic-items': {
    schema: MagicItemSchema,
    folder: 'magic-item',
    output: '5e-SRD-Magic-Items.json',
    checkRefs: checkMagicItemRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  condition: {
    schema: ConditionSchema,
    folder: 'condition',
    output: '5e-SRD-Conditions.json',
    checkRefs: checkConditionRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  language: {
    schema: LanguageSchema,
    folder: 'language',
    output: '5e-SRD-Languages.json',
    checkRefs: checkLanguageRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
  poisons: {
    schema: PoisonSchema,
    folder: 'poison',
    output: '5e-SRD-Poisons.json',
    checkRefs: checkPoisonRefs as (
      e: Entity,
    ) => Pick<Report, 'errors' | 'warnings'>,
  },
};

async function validateOne(
  outDir: string,
  slug: string,
  config: CategoryConfig,
): Promise<Report> {
  const dest = path.join(outDir, `${slug}.json`);
  const report: Report = { slug, errors: [], warnings: [] };

  let raw: unknown;
  try {
    raw = JSON.parse(await fs.readFile(dest, 'utf8'));
  } catch (err) {
    report.errors.push(`unreadable JSON: ${err}`);
    return report;
  }

  const result = config.schema.safeParse(raw);
  if (!result.success) {
    for (const issue of result.error.issues) {
      report.errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
    return report;
  }

  const refCheck = config.checkRefs(result.data as Entity);
  report.errors.push(...refCheck.errors);
  report.warnings.push(...refCheck.warnings);
  return report;
}

async function main() {
  const catKey = process.argv[2] ?? 'spell';
  const config = REGISTRY[catKey];
  if (!config) {
    console.error(
      `Unknown category '${catKey}'. Known: ${Object.keys(REGISTRY).join(', ')}`,
    );
    process.exit(1);
  }

  const outDir = path.join(DATA.out, config.folder);
  await fs.mkdir(outDir, { recursive: true });
  const slugs = (await fs.readdir(outDir))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));

  if (slugs.length === 0) {
    console.log(`No ${catKey} files to validate in ${outDir}`);
    return;
  }

  const reports = await Promise.all(
    slugs.map((s) => validateOne(outDir, s, config)),
  );

  // Orphan check: an assembled record whose source `.md` is gone is a stale leftover
  // (e.g. a spell slugged two ways — the renamed file lingers and ships a duplicate).
  // Flagging it as a per-record error both reports it and keeps it out of the aggregate.
  // Only meaningful where md filenames share the out slug scheme; we detect that via
  // overlap, which auto-skips categories whose md names differ (subclass: `<class>--…`)
  // or that have no per-item md at all (traits/subspecies/proficiencies, row-per-page
  // equipment/poison emit many records from one page).
  const mdSlugs = (() => {
    try {
      return new Set(
        readdirSync(path.join(DATA.md, config.folder))
          .filter((f) => f.endsWith('.md'))
          .map((f) => f.replace(/\.md$/, '')),
      );
    } catch {
      return new Set<string>();
    }
  })();
  if (slugs.some((s) => mdSlugs.has(s))) {
    for (const r of reports) {
      if (!mdSlugs.has(r.slug)) {
        r.errors.push(
          `no source data/md/${config.folder}/${r.slug}.md (orphan output)`,
        );
      }
    }
  }

  const valid: Entity[] = [];
  let withErrors = 0;
  let withWarnings = 0;
  let dropped = 0;
  for (const r of reports) {
    if (r.errors.length) {
      withErrors++;
      console.error(`✗ ${r.slug}: ${r.errors.join(' | ')}`);
    } else {
      let rec = JSON.parse(
        await fs.readFile(path.join(outDir, `${r.slug}.json`), 'utf8'),
      ) as Entity;
      // Apply the assembly-time transform (e.g. strip non-PHB Artificer); a null
      // result drops the record from the aggregated output.
      if (config.transform) {
        const t = config.transform(rec);
        if (t === null) {
          dropped++;
          continue;
        }
        rec = t;
      }
      valid.push(rec);
    }
    if (r.warnings.length) {
      withWarnings++;
      console.warn(`  ⚠ ${r.slug}: ${r.warnings.join(' | ')}`);
    }
  }

  // Guard against duplicate records in the assembled output. Per-item files are
  // assembled blindly from `data/out/<folder>/`, so a stale leftover (e.g. the same
  // spell slugged two ways — `tasha-s-...` vs `tashas-...`) would silently ship two
  // copies. Flag duplicate index OR name so it surfaces here instead of in the UI.
  let dupes = 0;
  for (const key of ['index', 'name'] as const) {
    const seen = new Map<string, string[]>();
    for (const rec of valid) {
      const v = (rec as Record<string, unknown>)[key] as string;
      (seen.get(v) ?? seen.set(v, []).get(v)!).push(rec.index);
    }
    for (const [v, idxs] of seen) {
      if (idxs.length > 1) {
        dupes++;
        console.error(`✗ duplicate ${key} '${v}': ${idxs.join(', ')}`);
      }
    }
  }
  if (dupes) {
    withErrors += dupes;
    process.exitCode = 1;
  }

  valid.sort((a, b) => a.index.localeCompare(b.index));
  const assembled = path.join(DATA.out, config.output);
  await fs.writeFile(assembled, JSON.stringify(valid, null, 2) + '\n', 'utf8');

  console.log(
    `\nValidated ${reports.length} ${catKey}: ${valid.length} valid, ${withErrors} with errors, ` +
      `${withWarnings} with warnings${dropped ? `, ${dropped} dropped at assembly` : ''}.\n` +
      `Assembled ${valid.length} records -> ${assembled}`,
  );
  if (withErrors) process.exitCode = 1;
}

await main();
