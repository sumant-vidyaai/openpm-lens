/**
 * Reserves. Contingency reserve covers identified risks ("known unknowns") and sits INSIDE the cost baseline; the project manager normally controls it.
 * Management reserve covers unidentified risks ("unknown unknowns") and sits ABOVE the baseline; the sponsor or senior management controls it.
 *   cost baseline  = work estimate + contingency reserve
 *   project budget = cost baseline + management reserve
 * (definitions and the worked example checked against a published guide). The reserves are amounts the user enters; the app never sets them.
 */
export interface ReserveStack {
  estimate: number;
  contingency: number | null;
  costBaseline: number | null;
  management: number | null;
  budget: number | null;
}

export function reserveStack(estimate: number, contingency: number | null, management: number | null): ReserveStack {
  const costBaseline = contingency === null ? null : estimate + contingency;
  const budget = costBaseline === null ? null : management === null ? null : costBaseline + management;
  return { estimate, contingency, costBaseline, management, budget };
}

export type ReserveState = 'no_overrun' | 'within_contingency' | 'needs_management' | 'exceeds_budget' | 'unknown';
export interface ReserveCheck {
  state: ReserveState;
  /** Share (0 to 1 or more) of the contingency reserve the overrun would use; null if there is no contingency figure or it is 0. */
  contingencyShare: number | null;
  /** Part of the overrun beyond contingency, which would need the management reserve (0 if none). */
  fromManagement: number;
  /** Part of the overrun beyond the whole project budget (0 if none). */
  beyondBudget: number;
}

/** Compares a forecast overrun (amount above the estimate; 0 or less means none) with the reserves. */
export function reserveCheck(stack: ReserveStack, overrun: number | null): ReserveCheck {
  if (overrun === null || stack.contingency === null) return { state: 'unknown', contingencyShare: null, fromManagement: 0, beyondBudget: 0 };
  if (overrun <= 0) return { state: 'no_overrun', contingencyShare: 0, fromManagement: 0, beyondBudget: 0 };
  const c = stack.contingency;
  const share = c > 0 ? overrun / c : null;
  if (overrun <= c) return { state: 'within_contingency', contingencyShare: share, fromManagement: 0, beyondBudget: 0 };
  const beyond = overrun - c;
  if (stack.management === null) return { state: 'needs_management', contingencyShare: share, fromManagement: beyond, beyondBudget: 0 };
  if (beyond <= stack.management) return { state: 'needs_management', contingencyShare: share, fromManagement: beyond, beyondBudget: 0 };
  return { state: 'exceeds_budget', contingencyShare: share, fromManagement: stack.management, beyondBudget: beyond - stack.management };
}
