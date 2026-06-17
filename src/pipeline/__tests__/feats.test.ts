import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { describe, it, expect } from 'vitest';
import { FeatSchema } from '../schemas/feat-2024.ts';
import { ROOT } from '../config.ts';

/**
 * Mirrors spells.test.ts. Skipped until `npm run validate feat` produces
 * data/out/5e-SRD-Feats.json.
 */
const file = path.join(ROOT, 'data', 'out', '5e-SRD-Feats.json');

describe.skipIf(!existsSync(file))('2024 feats', () => {
  // Guarded so the describe body doesn't throw during collection when skipped.
  const feats = existsSync(file)
    ? (JSON.parse(readFileSync(file, 'utf8')) as unknown[])
    : [];

  it('has records (did you run the pipeline?)', () => {
    expect(feats.length).toBeGreaterThan(0);
  });

  it('every feat matches FeatSchema', () => {
    for (const feat of feats) {
      const result = FeatSchema.safeParse(feat);
      const id = (feat as { index?: string }).index ?? '?';
      expect(result.success, `${id}: ${result.error?.message}`).toBe(true);
    }
  });

  it('indexes are unique', () => {
    const indexes = feats.map((f) => (f as { index: string }).index);
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('every feat type is one of the four PHB types', () => {
    const allowed = ['origin', 'general', 'fighting-style', 'epic-boon'];
    for (const feat of feats) {
      const { index, type } = feat as { index: string; type: string };
      expect(allowed, `${index} has type '${type}'`).toContain(type);
    }
  });

  // Every epic boon grants "+1 to an ability score, max 30". The extractor must
  // capture it structurally (see feat-extraction.md) so a builder can apply it:
  // a chooseable increase → an `abilities` choice; a fixed one (e.g. Boon of
  // Terror's +1 Charisma) → an `ability_bonuses` entry. Guard that every boon has
  // exactly one of the two, and that the abilities referenced are valid.
  it('every epic boon represents its ability increase (choice or fixed bonus)', () => {
    const abilities = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    const boons = feats.filter(
      (f) => (f as { type: string }).type === 'epic-boon',
    );
    expect(boons.length).toBeGreaterThan(0);
    for (const boon of boons) {
      const { index, choices, ability_bonuses } = boon as {
        index: string;
        choices?: {
          type?: string;
          desc?: string;
          from?: { options?: unknown[] };
        }[];
        ability_bonuses?: { ability_score?: { index?: string } }[];
      };
      const fixed = ability_bonuses ?? [];
      // The boon's Ability Score Increase ("+1 … to a maximum of 30") is captured
      // either as a fixed bonus, or as an `abilities` choice whose desc says "30".
      // (A boon may ALSO carry a separate spellcasting-ability `abilities` choice,
      // e.g. Boon of Siberys — so match the ASI choice by its max-30 desc.)
      const asiChoice = (choices ?? []).find(
        (c) => c.type === 'abilities' && /maximum of 30/i.test(c.desc ?? ''),
      );
      expect(
        fixed.length > 0 || asiChoice != null,
        `${index} must capture its ability increase as ability_bonuses or an abilities choice`,
      ).toBe(true);
      // The abilities referenced by whichever form must be valid keys.
      const refs = asiChoice
        ? (asiChoice.from?.options ?? []).map(
            (o) => (o as { item?: { index?: string } }).item?.index,
          )
        : fixed.map((a) => a.ability_score?.index);
      expect(refs.length, `${index} ability refs`).toBeGreaterThan(0);
      for (const r of refs) {
        expect(abilities.has(r ?? ''), `${index} ability '${r}'`).toBe(true);
      }
    }
  });

  // The `repeatable` flag is derived from prose (a "Repeatable." paragraph in the
  // feat's text). Guard the round-trip both ways: every feat whose desc declares
  // itself Repeatable carries `repeatable: true`, and nothing else does. This
  // catches a re-extraction silently dropping (or hallucinating) the flag.
  it('repeatable flag matches the Repeatable prose, both ways', () => {
    for (const feat of feats) {
      const { index, desc, repeatable } = feat as {
        index: string;
        desc: string[];
        repeatable?: boolean;
      };
      const saysRepeatable = (desc ?? []).some((p) =>
        /^Repeatable\.?\b/i.test(p),
      );
      expect(repeatable === true, `${index}: repeatable=${repeatable}`).toBe(
        saysRepeatable,
      );
    }
  });

  // An `abilities`-type choice is an ability-score increase by default, but some
  // feats reuse the shape to pick a spellcasting ability or a hit-point ability —
  // marked by `ability_use`. Guard that a choice whose prose isn't an "increase"
  // carries a non-`increase` `ability_use` (so the builder doesn't bump a score for
  // it), and an increase choice doesn't. Catches a re-extraction dropping the field.
  it('abilities choices mark non-increase picks with ability_use', () => {
    for (const feat of feats) {
      const { index, choices } = feat as {
        index: string;
        choices?: { type?: string; desc?: string; ability_use?: string }[];
      };
      for (const c of choices ?? []) {
        if (c.type !== 'abilities') continue;
        const use = c.ability_use ?? 'increase';
        const isIncrease = /increase/i.test(c.desc ?? '');
        expect(use === 'increase', `${index}: '${c.desc}' use=${use}`).toBe(
          isIncrease,
        );
      }
    }
  });
});
