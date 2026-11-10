import { describe, expect, it } from 'vitest';
import { caseStudy, practiceQuestions } from '../src';

describe('practice questions', () => {
  const all = [...practiceQuestions(), ...caseStudy().steps];
  it('every question has distinct choices and its answer points at a real choice', () => {
    for (const x of all) {
      expect(new Set(x.choices).size, x.id).toBe(x.choices.length);
      expect(x.answer, x.id).toBeGreaterThanOrEqual(0);
      expect(x.answer, x.id).toBeLessThan(x.choices.length);
    }
  });
  it('ids are unique and nothing says "?" (a value that could not be calculated)', () => {
    expect(new Set(all.map((x) => x.id)).size).toBe(all.length);
    for (const x of all) { expect(x.choices.join('|'), x.id).not.toContain('?'); expect(x.explain, x.id).not.toContain('?'); }
  });
  it('the right answers match hand-worked values', () => {
    const right = Object.fromEntries(all.map((x) => [x.id, x.choices[x.answer]]));
    expect(right['cpi']).toBe('0.8');
    expect(right['spi']).toBe('0.75');
    expect(right['eac']).toBe('1250');
    expect(right['tcpi']).toBe('1.2');
    expect(right['pert']).toBe('5');
    expect(right['float']).toBe('8');
    expect(right['npv']).toBe('1,859.47');
    expect(right['score']).toBe('9.1');
    expect(right['bpi']).toBe('0.92');
    expect(right['grid']).toBe('Keep satisfied');
    expect(right['reserve']).toBe('11,100');
    expect(right['risk']).toBe('12');
  });
  it('the case study matches the example file (CPI 0.85, CV -59, EAC 701.5, overrun 107.5 beyond 100 of reserves)', () => {
    const s = Object.fromEntries(caseStudy().steps.map((x) => [x.id, x.choices[x.answer]]));
    expect(s['c1']).toBe('0.85');
    expect(s['c2']).toBe('-59');
    expect(s['c3']).toBe('701.5');
    expect(s['c4']).toContain('107.5 hours: more than contingency and management reserve together (100 hours)');
  });
});
