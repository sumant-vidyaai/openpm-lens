import type { StatusCategory } from './model';

/**
 * How percent complete is determined for earned value.
 *
 * There is no single correct rule, so the user picks one per tool and the choice is shown
 * on screen beside every EVM number.
 *
 *  - tool_reported: use the percentage the tool reports (0-100).
 *  - zero_hundred: 0% until done, then 100%.
 *  - fifty_fifty: 0% not started, 50% in progress, 100% done.
 *  - status_based: 0% not started, a percentage YOU choose while in progress, 100% done.
 */
export type PercentRule = 'tool_reported' | 'zero_hundred' | 'fifty_fifty' | 'status_based';

export interface PercentInput {
  /** 0-100 as reported by the tool, or null if absent. */
  reportedPercent: number | null;
  statusCategory: StatusCategory | null;
}

export interface StatusBasedConfig {
  /** Percent (0-100) credited to items that are in progress. Required for status_based. */
  inProgressPercent: number;
}

export interface PercentResult {
  /** 0-100, or null when no percentage can be determined. */
  value: number | null;
  /** Canonical fields needed but absent. */
  missing: string[];
  /** Problems with the supplied values (out of range, cancelled...). */
  issues: string[];
  /** One-line description of the rule applied, for display next to the result. */
  assumption: string;
}

const ASSUMPTIONS: Record<PercentRule, string> = {
  tool_reported: 'Percent complete as reported by the source tool.',
  zero_hundred: '0/100 rule: 0% until the item is done, then 100%.',
  fifty_fifty: '50/50 rule: 0% not started, 50% in progress, 100% done.',
  status_based: 'Status-based rule: 0% not started, a chosen percentage while in progress, 100% done.',
};

export function percentComplete(
  rule: PercentRule,
  input: PercentInput,
  config?: StatusBasedConfig,
): PercentResult {
  const base = { missing: [] as string[], issues: [] as string[], assumption: ASSUMPTIONS[rule] };

  if (rule === 'tool_reported') {
    if (input.reportedPercent === null) {
      return { ...base, value: null, missing: ['percentCompleteReported'] };
    }
    if (!Number.isFinite(input.reportedPercent) || input.reportedPercent < 0 || input.reportedPercent > 100) {
      return {
        ...base,
        value: null,
        issues: [`Reported percent ${input.reportedPercent} is outside 0-100; not used.`],
      };
    }
    return { ...base, value: input.reportedPercent };
  }

  if (rule === 'status_based') {
    if (
      !config ||
      !Number.isFinite(config.inProgressPercent) ||
      config.inProgressPercent < 0 ||
      config.inProgressPercent > 100
    ) {
      throw new RangeError('status_based rule needs config.inProgressPercent between 0 and 100');
    }
  }

  if (input.statusCategory === null) {
    return { ...base, value: null, missing: ['statusCategory'] };
  }
  if (input.statusCategory === 'cancelled') {
    return {
      ...base,
      value: null,
      issues: ['Item is cancelled; excluded from earned value.'],
    };
  }

  switch (input.statusCategory) {
    case 'not_started':
      return { ...base, value: 0 };
    case 'done':
      return { ...base, value: 100 };
    case 'in_progress':
      if (rule === 'zero_hundred') return { ...base, value: 0 };
      if (rule === 'fifty_fifty') return { ...base, value: 50 };
      return { ...base, value: config ? config.inProgressPercent : null };
  }
}

/**
 * Story-point based progress for a whole scope: completed points / total points, as 0-100.
 * Null when total points is missing or not positive.
 */
export function storyPointPercent(completedPoints: number, totalPoints: number): number | null {
  if (!Number.isFinite(completedPoints) || !Number.isFinite(totalPoints) || totalPoints <= 0) {
    return null;
  }
  if (completedPoints < 0 || completedPoints > totalPoints) return null;
  return (completedPoints / totalPoints) * 100;
}
