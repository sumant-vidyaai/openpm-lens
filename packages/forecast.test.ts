import { describe, expect, it } from 'vitest';
import { forecast } from '../src/forecast';

// BAC 200, EV 80, AC 100, PV 100: CPI 0.8, SPI 0.8, CPI x SPI 0.64.
const input = { ev: 80, ac: 100, bac: 200, pv: 100 };

describe('forecast (hand-checked)', () => {
  it('typical: EAC = BAC / CPI', () => {
    const r = forecast(input, 'typical');
    expect(r.eac).toBeCloseTo(250);
    expect(r.etc).toBeCloseTo(150);
    expect(r.vac).toBeCloseTo(-50);
    expect(r.tcpiBac).toBeCloseTo(1.2); // (200-80)/(200-100)
    expect(r.tcpiEac).toBeCloseTo(0.8); // 120/150
  });
  it('atypical: EAC = AC + (BAC - EV)', () => {
    const r = forecast(input, 'atypical');
    expect(r.eac).toBe(220);
    expect(r.etc).toBe(120);
    expect(r.vac).toBe(-20);
  });
  it('cpi x spi: EAC = AC + (BAC - EV) / (CPI x SPI)', () => {
    expect(forecast(input, 'cpi_spi').eac).toBeCloseTo(287.5);
  });
  it('cpi x spi needs planned value', () => {
    const r = forecast({ ...input, pv: null }, 'cpi_spi');
    expect(r.eac).toBeNull();
    expect(r.reasons.join(' ')).toContain('status date');
  });
  it('unavailable inputs give nothing, with a reason', () => {
    const r = forecast({ ev: null, ac: null, bac: null, pv: null }, 'typical');
    expect(r.eac).toBeNull();
    expect(r.reasons.length).toBeGreaterThan(0);
  });
  it('typical needs a CPI: zero actual cost gives no EAC', () => {
    const r = forecast({ ev: 0, ac: 0, bac: 100, pv: null }, 'typical');
    expect(r.eac).toBeNull();
    expect(r.reasons.join(' ')).toContain('CPI');
  });
  it('TCPI against the budget is not meaningful once spend reaches the budget', () => {
    const r = forecast({ ev: 50, ac: 120, bac: 100, pv: null }, 'atypical');
    expect(r.tcpiBac).toBeNull();
    expect(r.reasons.join(' ')).toContain('not meaningful');
  });
  it('shows the working with the real numbers', () => {
    const r = forecast(input, 'typical');
    const text = r.steps.map((s) => s.steps.join(' ')).join(' ');
    expect(text).toContain('EAC = 200 / 0.8');
    expect(text).toContain('EAC = 250 hours');
  });
});
