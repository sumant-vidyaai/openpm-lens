import type {
  Assignment,
  CostEntry,
  DataIssue,
  Dependency,
  Project,
  Resource,
  Sprint,
  TimeEntry,
  WorkItem,
} from './model';

/**
 * The adapter interface: how a tool plugs into the app.
 *
 * An adapter converts ONE tool's export into the canonical model and reports honestly
 * which canonical fields it could not supply. Adapters are plugins: a contributor adds one
 * without touching the formula library or the screens.
 *
 * v0.1 defines the contract only. The generic CSV/XLSX importer will be the first adapter.
 */

/** What the adapter is given. Files are read in the browser; nothing is uploaded. */
export interface AdapterInput {
  fileName: string;
  /** Raw file contents. Text formats arrive as string, binary formats (xlsx) as bytes. */
  content: string | Uint8Array;
}

export interface DetectResult {
  /** True if this adapter recognises the file. */
  matches: boolean;
  /** 0-1 confidence, used when several adapters match. */
  confidence: number;
  reason: string;
}

/** One row of the "tool column -> canonical field" table, editable on the mapping screen. */
export interface FieldMapping {
  /** Column or property name in the source file. */
  sourceField: string;
  /** Canonical field path, e.g. "workItem.estimate". Null means deliberately unmapped. */
  canonicalField: string | null;
  /** Optional note, e.g. "Jira stores this in seconds". */
  note?: string;
}

/** A user-selectable option, such as which percent-complete rule applies to this tool. */
export interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}

export interface ParseResult {
  projects: Project[];
  workItems: WorkItem[];
  dependencies: Dependency[];
  resources: Resource[];
  assignments: Assignment[];
  timeEntries: TimeEntry[];
  costEntries: CostEntry[];
  sprints: Sprint[];
  /** The mapping actually used, so the app can show it and the user can change it. */
  fieldMappings: FieldMapping[];
  /** Source columns that were present but not mapped to anything. */
  unmappedSourceFields: string[];
  /** File-level problems (unreadable rows, unexpected layout...). Row-level problems live on records. */
  issues: DataIssue[];
}

export interface Adapter {
  /** Stable machine id, e.g. "generic-csv". */
  id: string;
  /** Neutral descriptive name shown to users. */
  name: string;
  version: string;
  /** How data arrives: file import, or live API call from the browser. */
  modes: ('file' | 'api')[];

  detect(input: AdapterInput): DetectResult;
  parse(input: AdapterInput, settings: Record<string, string>): ParseResult;

  /** Canonical fields this adapter CAN supply. Feeds the capability matrix. */
  suppliedFields: string[];
  /** Canonical fields this adapter can NOT supply. The matrix names these exactly. */
  missingFields: string[];
  settings: SettingDefinition[];
}
