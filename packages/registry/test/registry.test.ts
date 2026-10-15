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
