import { describe, expect, it } from 'vitest';
import {
  costPerformanceIndex,
  costVariance,
  costVariancePercent,
  eacAtypical,
  eacBottomUp,
  eacCpiSpi,
  eacTypical,
  estimateToComplete,
  percentCompleteBudget,
  percentSpent,
  safeDivide,
  schedulePerformanceIndex,
  scheduleVariance,
  scheduleVariancePercent,
  tcpiToBac,
  tcpiToEac,
  varianceAtCompletion,
} from '../src/evm';

/**
 * Worked example used throughout (checked by hand):
 *   BAC = 1000, PV = 500, EV = 400, AC = 450
 *   SV = 400 - 500 = -100          CV = 400 - 450 = -50
 *   SPI = 400 / 500 = 0.8          CPI = 400 / 450 = 0.888888...
 *   SV% = -100 / 500 = -0.2        CV% = -50 / 400 = -0.125
 *   EAC typical  = 1000 / (400/450) = 1125
 *   EAC atypical = 450 + (1000 - 400) = 1050
 *   EAC CPIxSPI  = 450 + 600 / (0.8888... x 0.8) = 450 + 843.75 = 1293.75
 *   ETC (typical) = 1125 - 450 = 675      VAC (typical) = 1000 - 1125 = -125
 *   TCPI(BAC) = (1000 - 400) / (1000 - 450) = 600 / 550 = 1.0909...
 *   TCPI(EAC) = 600 / (1125 - 450) = 600 / 675 = 0.8888...
 */
const BAC = 1000;
const PV = 500;
const EV = 400;
const AC = 450;

describe('EVM worked example', () => {
  it('variances', () => {
    expect(scheduleVariance(EV, PV)).toBe(-100);
    expect(costVariance(EV, AC)).toBe(-50);
    expect(scheduleVariancePercent(EV, PV)).toBeCloseTo(-0.2, 10);
    expect(costVariancePercent(EV, AC)).toBeCloseTo(-0.125, 10);
  });

  it('performance indices', () => {
    expect(schedulePerformanceIndex(EV, PV)).toBeCloseTo(0.8, 10);
    expect(costPerformanceIndex(EV, AC)).toBeCloseTo(0.888888889, 8);
  });

  it('percent complete and percent spent', () => {
    expect(percentCompleteBudget(EV, BAC)).toBeCloseTo(0.4, 10);
    expect(percentSpent(AC, BAC)).toBeCloseTo(0.45, 10);
  });

  it('all four EAC variants', () => {
    expect(eacTypical(BAC, EV, AC)).toBeCloseTo(1125, 8);
    expect(eacAtypical(BAC, EV, AC)).toBe(1050);
    expect(eacCpiSpi(BAC, EV, AC, PV)).toBeCloseTo(1293.75, 8);
    expect(eacBottomUp(AC, 700)).toBe(1150);
  });

  it('ETC and VAC', () => {
    const eac = eacTypical(BAC, EV, AC) as number;
    expect(estimateToComplete(eac, AC)).toBeCloseTo(675, 8);
    expect(varianceAtCompletion(BAC, eac)).toBeCloseTo(-125, 8);
  });

  it('TCPI to BAC and to EAC', () => {
    expect(tcpiToBac(BAC, EV, AC)).toBeCloseTo(600 / 550, 10);
    const eac = eacTypical(BAC, EV, AC) as number;
    expect(tcpiToEac(BAC, EV, AC, eac)).toBeCloseTo(0.888888889, 8);
  });
});

describe('undefined results return null, never NaN or a made-up number', () => {
  it('safeDivide', () => {
    expect(safeDivide(1, 0)).toBeNull();
    expect(safeDivide(Number.NaN, 1)).toBeNull();
    expect(safeDivide(1, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it('SPI with zero planned value', () => {
    expect(schedulePerformanceIndex(10, 0)).toBeNull();
    expect(scheduleVariancePercent(10, 0)).toBeNull();
  });

  it('CPI with zero actual cost', () => {
    expect(costPerformanceIndex(10, 0)).toBeNull();
  });

  it('typical EAC when nothing has been earned (CPI = 0)', () => {
    expect(eacTypical(1000, 0, 100)).toBeNull();
  });

  it('CPI x SPI EAC when either index is undefined', () => {
    expect(eacCpiSpi(1000, 400, 0, 500)).toBeNull();
    expect(eacCpiSpi(1000, 400, 450, 0)).toBeNull();
  });

  it('TCPI to BAC when the budget is exactly used up', () => {
    expect(tcpiToBac(1000, 400, 1000)).toBeNull();
  });

  it('non-finite inputs', () => {
    expect(scheduleVariance(Number.NaN, 1)).toBeNull();
    expect(eacAtypical(1000, Number.POSITIVE_INFINITY, 1)).toBeNull();
  });
});
