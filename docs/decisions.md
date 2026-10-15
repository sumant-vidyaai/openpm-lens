# Decisions and roadmap

Decisions agreed with the project owner on 15 October 2026.

## Decisions

| Topic | Decision |
|---|---|
| Licence | Apache-2.0 (explicit patent grant, clear contributor terms). |
| Hosting | Cloudflare Pages free plan (static files; no project data ever reaches the host). Indian mirror optional later. |
| Blocked browsers | Tools that block direct browser calls (e.g. Jira Cloud) are file-import only in v1. No hosted proxy, because it would break "no data to any server". |
| Live API connectors | Only where the tool allows browser calls (e.g. Azure DevOps). Optional and clearly marked; tokens in memory only. |
| Metric grouping | Two neutral tags per card: `domain` (broad group) and `area` (traditional group). No third-party framework names or trademarks. |
| Sample data | Synthetic only, imitating each tool's export format. From the owner's PPM exports, column headers only, never rows. |
| Missing planned hours | Default "exclude and flag". Optional "treat as zero" with the assumption flagged. Missing actual hours or percent complete always exclude. |
| Percent complete | Visible per-tool setting (tool-reported, 0/100, 50/50, status-based). |
| Stack | TypeScript, Vite, React, Vitest; static site on Cloudflare Pages; offline support via service worker; GitHub Actions for tests. |
| Privacy rules | No tracking or analytics; nothing loaded from other websites at runtime; strict browser security policy; downloadable release bundle with checksum; dependency list kept small. |

## Connector order (proposed)

1. Generic CSV/XLSX importer with column mapping.
2. MS Project XML (MSPDI).
3. Jira CSV.
4. Azure DevOps (CSV, then browser REST).
5. Flow-focused tools (Linear, GitHub Projects, Trello, ClickUp).
6. Enterprise PPM (Clarity, Workfront, ServiceNow, Planview, Smartsheet).

## Status

- [x] v0.1 foundation: licence, README, contributing, security, canonical model types,
      adapter interface types, EVM formula library, percent-complete rules, safe unit
      parsing, missing-data aggregation, six metric recipe cards, 80 automated tests.
- [ ] Synthetic sample exports (Jira, Azure DevOps, MS Project style).
- [x] Web app shell (Vite + React) with light/dark mode, strict security policy, offline service worker and a metric library page (`packages/web`).
- [x] CSV importer with mapping screen, unit/percent/status choices and EV/AC/CPI/CV results (v0.3). [ ] Excel (.xlsx) reading still to do, after a library licence check.
- [ ] First two adapters.
- [ ] Dashboard with capability matrix, data-quality score and step-by-step explanations.
- [ ] More metrics: earned schedule, schedule (critical path, PERT), cost, risk, quality,
      resource, agile/flow, Monte Carlo.
- [ ] Documentation site; publish via GitHub and Cloudflare Pages.

## Open items

- Review the `domain` and `area` tag chosen for each metric.
- Choose and licence-check the spreadsheet-reading and charting libraries.
- Project name chosen: openpm-lens. Check for name clashes before wider promotion; consider trademark registration later.
- Confirm copyright holder wording in `NOTICE`.
