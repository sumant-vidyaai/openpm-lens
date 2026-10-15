import type { ColumnMapping } from './importTasks';
import type { Unit } from './model';
import type { PercentRule } from './percentComplete';

/**
 * Table adapters: lightweight, tool-specific knowledge for files that arrive as a table
 * (CSV or a spreadsheet). They recognise a tool's export by its column names, suggest the
 * column mapping, the unit its numbers use, and say plainly what the tool does NOT provide.
 * The user can always override every suggestion on screen.
 */
export interface TableSuggestion {
  mapping: ColumnMapping;
  /** Unit that plain numbers in effort columns use in this tool's export. */
  defaultUnit: Unit | null;
  /** Percent-complete rule that suits the tool, when it does not report a usable percentage. */
  suggestedRule: PercentRule | null;
  /** Plain-language notes shown to the user, including limits and things to verify. */
  notes: string[];
}

export interface TableAdapter {
  id: string;
  /** Neutral name used only to identify the file format. */
  name: string;
  detect(headers: string[]): { matches: boolean; confidence: number; reason: string };
  suggest(headers: string[]): TableSuggestion;
}

const norm = (h: string) => h.trim().toLowerCase().replace(/\s+/g, ' ');
const isSum = (h: string) => /^(σ|∑|sum)\b/i.test(h.trim()) || h.trim().startsWith('Σ');

function find(headers: string[], names: string[]): string | null {
  for (const name of names) {
    const hit = headers.find((h) => !isSum(h) && norm(h) === name);
    if (hit) return hit;
  }
  return null;
}

export const jiraAdapter: TableAdapter = {
  id: 'jira-csv',
  name: 'Jira CSV export',

  detect(headers) {
    const key = find(headers, ['issue key', 'key']);
    const summary = find(headers, ['summary']);
    const extra = find(headers, ['issue type', 'issue id', 'status category']);
    if (key && summary && extra) {
      return { matches: true, confidence: 0.9, reason: 'Found Issue key, Summary and Issue type/id columns.' };
    }
    if (key && summary) {
      return { matches: true, confidence: 0.6, reason: 'Found Issue key and Summary columns.' };
    }
    return { matches: false, confidence: 0, reason: 'No Issue key and Summary columns.' };
  },

  suggest(headers) {
    const statusCategory = find(headers, ['status category']);
    const mapping: ColumnMapping = {
      id: find(headers, ['issue key', 'key']),
      name: find(headers, ['summary']),
      status: statusCategory ?? find(headers, ['status']),
      planned: find(headers, ['original estimate', 'time original estimate']),
      actual: find(headers, ['time spent', 'timespent']),
      percent: null,
    };
    const notes = [
      'Jira exports time tracking values in seconds (Atlassian documents this for Original Estimate; please confirm your Time Spent column looks the same). Plain numbers are read as seconds.',
      'Jira has no % complete field. Progress is worked out from status, so choose a status-based rule below. We start with 0/100, the most cautious.',
      'Columns starting with the sum sign (parent totals) are not used, to avoid counting sub-task time twice.',
      'Columns are matched by name. If your Jira uses other names, change the choice in step 1.',
    ];
    if (statusCategory) notes.push('Using the Status Category column, which groups every status into To Do, In Progress or Done.');
    if (mapping.planned === null) notes.push('No Original estimate column found. Planned effort will be missing, so tasks will be left out.');
    if (mapping.actual === null) notes.push('No Time Spent column found. Actual effort will be missing, so tasks will be left out.');
    return { mapping, defaultUnit: 'seconds', suggestedRule: 'zero_hundred', notes };
  },
};

export const TABLE_ADAPTERS: TableAdapter[] = [jiraAdapter];

/** The best-matching adapter for these headers, or null for a generic file. */
export function detectTableAdapter(headers: string[]): TableAdapter | null {
  let best: { adapter: TableAdapter; confidence: number } | null = null;
  for (const adapter of TABLE_ADAPTERS) {
    const d = adapter.detect(headers);
    if (d.matches && (best === null || d.confidence > best.confidence)) best = { adapter, confidence: d.confidence };
  }
  return best?.adapter ?? null;
}
