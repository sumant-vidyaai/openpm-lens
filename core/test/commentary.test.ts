import { describe, expect, it } from 'vitest';
import { writeCommentary, type ReportFacts } from '../src';

const base: ReportFacts = { statusDate: '2026-03-31', health: 'amber', cpi: 0.8468, spi: 0.8371, counts: { total: 14, done: 6, inProgress: 4, notStarted: 3, cancelled: 1 }, openDefects: 1, milestones: null, forecast: null, raid: null, drags: [] };

describe('status commentary', () => {
  it('states health and indexes to two decimals, with the shortfall worked out', () => {
    const c = writeCommentary(base);
    expect(c.headline).toBe('As of 2026-03-31 the project is amber: watch.');
    expect(c.concerns).toContain('Cost index (CPI) is 0.85: each hour spent has so far earned 0.85 hours of planned work.');
    expect(c.concerns).toContain('Schedule index (SPI) is 0.84: 16% less planned work is done than the plan called for by this date.');
  });
  it('counts active items without cancelled ones, and says so', () => {
    expect(writeCommentary(base).highlights).toContain('6 of 13 active items are done; 4 in progress, 3 not started (1 cancelled, left out).');
    expect(writeCommentary(base).concerns).toContain('1 defect still open.');
  });
  it('good indexes are highlights, not concerns', () => {
    const c = writeCommentary({ ...base, cpi: 1.05, spi: 1 });
    expect(c.highlights.some((s) => s.startsWith('Cost index (CPI) is 1.05'))).toBe(true);
    expect(c.concerns.some((s) => s.startsWith('Schedule'))).toBe(false);
  });
  it('forecast below 50% chance is a concern; RAID facts are reported with their numbers', () => {
    const c = writeCommentary({
      ...base,
      forecast: { open: 6, date50: '2026-04-28', date85: '2026-05-12', date95: '2026-05-19', plannedFinish: '2026-04-24', chancePlanned: 0.32, verdictNote: 'Fewer than 6 weeks of history.' },
      raid: { highRisks: 1, openRisks: 4, overdueActions: 1, openIssues: 3, overdueIssues: 1, oldestIssueDays: 30, approvedHours: 38, approvedDays: 5, scopeGrowthPercent: 7.04, waitingRequests: 1 },
    });
    expect(c.concerns).toContain('At the recent weekly pace, the 6 open items are 85% likely to be finished by 2026-05-12 (50%: 2026-04-28, 95%: 2026-05-19). The chance of meeting the latest planned finish (2026-04-24) is about 32%.');
    expect(c.concerns).toContain('1 open risk rated high (of 4 open).');
    expect(c.concerns).toContain('3 open issues, 1 overdue; the oldest has been open 30 days.');
    expect(c.concerns).toContain('Approved changes have added 38 hours and 5 days (7% of the original budget).');
    expect(c.limits).toContain('Fewer than 6 weeks of history.');
  });
  it('missing facts are left out, never invented', () => {
    const c = writeCommentary({ ...base, health: 'insufficient', cpi: null, spi: null, counts: null, openDefects: null });
    expect([...c.highlights, ...c.concerns]).toEqual([]);
    expect(c.limits).toContain('Too little data to rate overall health.');
  });
});
