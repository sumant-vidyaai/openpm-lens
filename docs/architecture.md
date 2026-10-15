# Architecture

## Layers

| Layer | Folder | Responsibility |
|---|---|---|
| Formula library | `packages/core` | Pure maths, canonical data model types, adapter interface types. No screens, no network, no file access. |
| Metric registry | `packages/registry` | Each metric declared as a YAML "recipe card"; loader and validator. |
| Adapters (planned) | `packages/adapters` | One plugin per tool, plus the generic CSV/XLSX importer. |
| Web app (planned) | `apps/web` | Importer, mapping screen, capability matrix, dashboards, explanations. Static files only. |

The app is a static site. All calculation happens in the user's browser.

## Canonical data model

Defined in `packages/core/src/model.ts`. Every tool's export is translated into it first;
formulas read only the model.

Rules:

1. **Raw values are kept.** A `Quantity` stores the original text (`"8.5 Hours"`), the parsed
   number (`8.5`) and the unit (`hours`).
2. **Missing is `null`.** A blank cell never becomes zero.
3. **Problems are flagged on the record** as `DataIssue` entries (missing value, unparseable,
   ambiguous decimal comma, unknown unit, finish before start, tool calculation disagrees...).
4. **Tool-calculated fields are stored in `toolCalculated`** for comparison. Calculations always
   recompute from raw fields.
5. **Roll-ups are configuration.** Records carry free-form `dimensions` (team, department,
   location, agency...). Task to project to program to portfolio is expressed through ids.

v0.1 defines Project, WorkItem, Dependency, Resource, Assignment, TimeEntry, CostEntry and
Sprint. Risk, Issue, Change request, Defect, Stakeholder, Procurement item and Benefit follow
the same rules and are planned.

## Adapter interface

Defined in `packages/core/src/adapter.ts`. An adapter declares:

- `id`, `name`, `version`, `modes` (file and/or API);
- `detect(input)`: does this adapter recognise the file?
- `parse(input, settings)`: convert to canonical records, returning the field mapping used,
  unmapped source columns and file-level issues;
- `suppliedFields` and `missingFields`: which canonical fields it can and cannot supply. These
  feed the capability matrix, so "not available" always names the exact missing field;
- `settings`: user-selectable options, for example the percent-complete rule.

The generic CSV/XLSX importer will be the first adapter; its mapping screen edits the
`fieldMappings` list.

## Metric registry

Each card (see `packages/registry/metrics/`) declares: `id`, `name`, `domain`,
`area`, `formula`, `meaning`, `required`, `optional`, `interpretation`
(with the note that thresholds are starting values, not a standard) and a `worked_example`
(inputs, steps, expected, decimals).

The registry test runs every worked example through the function registered for that id in
`packages/core/src/metrics.ts`, so documentation and code cannot drift apart.

A metric result is one of:

- **computed**;
- **computed with caveats** (records excluded or an assumption applied; caveats listed);
- **not available** (the exact missing fields are named).

A health status (Red/Amber/Green) will show "Insufficient data" when too few records support it.

### Domain and area tags

`domain` is a broad group (Schedule, Finance, Scope, Resources, Risk and so on) used to
organise the dashboard. `area` is a second, more traditional grouping so a metric can be
found either way. Both are plain words chosen by this project; no third-party framework or
trademarked name is used.

## Percent complete and missing data (approved rules)

- **Percent complete** is determined by a visible, per-tool setting: tool-reported, 0/100,
  50/50 or status-based (with a user-chosen in-progress percentage). The rule is shown beside
  every EVM number. Implemented in `packages/core/src/percentComplete.ts`.
- **Missing planned hours** are handled by an explicit policy. Default: exclude the task and
  flag it. Optional: treat as zero, with the assumption flagged on every affected result.
  Missing actual hours or percent complete always exclude the task; they are never guessed.
  Implemented in `packages/core/src/aggregate.ts`.
- Displayed numbers use `roundHalfUp`; calculations use unrounded values.

## Privacy and security

No tracking, no analytics, no runtime requests to other websites, a strict browser security
policy on the built app, API tokens in memory only, and downloadable release bundles that can
be hosted internally. See `SECURITY.md`.
