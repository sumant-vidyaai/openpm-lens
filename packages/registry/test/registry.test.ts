import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { metricFunctions } from '@openpm-lens/core';
import { loadCards } from '../src/loader';
import { validateCard } from '../src/card';

const metricsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'metrics');
const cards = loadCards(metricsDir);

describe('metric registry', () => {
  it('finds the recipe cards', () => {
    expect(cards.length).toBeGreaterThan(0);
  });

  it('has unique ids', () => {
    const ids = cards.map((c) => c.card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has a formula function registered for every card, and a card for every function', () => {
    const cardIds = cards.map((c) => c.card.id).sort();
    const functionIds = Object.keys(metricFunctions).sort();
    expect(functionIds).toEqual(cardIds);
  });
});

describe.each(cards.map((c) => [c.card.id, c.card] as const))('card %s', (id, card) => {
  it('is structurally valid', () => {
    expect(validateCard(card)).toEqual([]);
  });

  it('provides every required input in its worked example', () => {
    for (const name of card.required) {
      expect(card.worked_example.inputs, `input ${name}`).toHaveProperty(name);
    }
  });

  it('worked example, run through the formula library, gives the documented answer', () => {
    const fn = metricFunctions[id];
    expect(fn, `no function registered for ${id}`).toBeDefined();
    const actual = (fn as NonNullable<typeof fn>)(card.worked_example.inputs);
    expect(actual).not.toBeNull();
    expect(actual as number).toBeCloseTo(card.worked_example.expected, card.worked_example.decimals);
  });

  it('shows a step-by-step walkthrough', () => {
    expect(card.worked_example.steps.length).toBeGreaterThanOrEqual(2);
  });
});

describe('validateCard', () => {
  it('rejects interpretation notes that do not disclaim thresholds', () => {
    const bad = {
      id: 'x.y',
      name: 'X',
      domain: 'Finance',
      area: 'Cost',
      formula: 'X = 1',
      meaning: 'm',
      required: ['A'],
      optional: [],
      interpretation: { note: 'Green is good.', bands: [] },
      worked_example: { inputs: { A: 1 }, steps: ['a', 'b'], expected: 1, decimals: 1 },
    };
    expect(validateCard(bad).join(' ')).toContain('not a standard');
  });

  it('rejects a card with no required inputs', () => {
    expect(validateCard({ required: [] }).join(' ')).toContain('at least one input');
  });
});

// Trust check: what the Learn tab teaches must say the same as the metric cards and the numbers the app uses.
import { DEFAULT_THRESHOLDS } from '@openpm-lens/core';
import { TERMS } from '../../web/src/learnContent';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
import { EAC_METHODS } from '@openpm-lens/core';
describe('Learn tab agrees with the metric cards', () => {
  it.each(EAC_METHODS.map((m) => [m.value, m.formula] as const))('the %s forecast method is taught with the formula the app uses', (_v, formula) => {
    expect(TERMS.map((t) => norm(t.formula ?? ''))).toContain(norm(formula));
  });
  it.each(cards.map((c) => [c.card.id, c.card] as const))('%s has a Learn entry with the same formula', (_id, card) => {
    const learn = TERMS.filter((t) => t.formula !== undefined).map((t) => norm(t.formula as string));
    expect(learn).toContain(norm(card.formula));
  });
  it('the starting health limits on the CPI and SPI cards equal the limits the app uses', () => {
    for (const id of ['evm.cpi', 'evm.spi']) {
      const card = cards.find((c) => c.card.id === id)!.card;
      const rules = card.interpretation.bands.map((b) => b.rule).join(' | ');
      expect(rules).toContain(String(DEFAULT_THRESHOLDS.greenMin));
      expect(rules).toContain(String(DEFAULT_THRESHOLDS.amberMin));
    }
  });
});
