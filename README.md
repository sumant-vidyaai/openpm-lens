# openpm-lens

An open-source, tool-agnostic project management analytics app. Bring an export from the
tool you already use and get standard project metrics, health scores and dashboards for waterfall,
Agile, Kanban and hybrid work, with every number explained step by step.

**Status: v0.23 (pre-1.0).** Import (CSV, Excel, Microsoft Project XML), cost and schedule
metrics with forecasts and earned schedule, portfolio roll-up with health status, flow metrics,
schedule, cost in money, resources, quality (defects), charts, a Learn section and an Overview home screen, a fill-in Excel/CSV template, holidays and leave, "why is it red", milestones, cash flow, a risks, issues and changes log, and dated snapshots with trend charts. See
`docs/user-guide.md` for how to use it and `docs/decisions.md` for every design decision.

## Principles

1. **Privacy first.** The app runs in the browser. Project data is never uploaded to any
   server, there is no tracking, and API tokens (when connectors arrive) stay in memory only.
2. **Never fake a number.** A missing value stays missing. A metric is shown as
   *computed*, *computed with caveats*, or *not available* with the exact missing field named.
3. **Recompute from raw fields.** Values calculated by a source tool (variance, "is late"
   flags) are kept for comparison but never trusted.
4. **Explain everything.** Every metric carries its formula, inputs and a worked example,
   and that example doubles as an automatic test.
5. **Assumptions are visible.** Choices such as how percent complete is determined, or how
   tasks with no planned hours are treated, are explicit settings shown next to the result.

## Quick start (for contributors)

Requires Node.js 22 or newer.

```bash
npm install
npm test          # runs every unit test and every metric worked example
npm run typecheck # checks the TypeScript types
```

## Repository layout

| Folder | What it holds |
|---|---|
| `packages/core` | Pure formula library, canonical data model types, adapter interface types. No screens, no network. |
| `packages/registry` | Metric recipe cards (YAML) and the loader/validator. |
| `docs` | Architecture, decisions and contributor guides. |
| `local-data/` | (Ignored by Git.) Put real exports here on your own machine. Never commit them. |

## How a metric is defined

Each metric is a YAML card in `packages/registry/metrics/`. It names its domain and area, the
formula, its meaning in plain language, the inputs it needs, how to read the result, and one
worked example. A test runs the worked example through the formula library, so documentation
and code cannot drift apart. See `CONTRIBUTING.md` to add one.

## Documentation

- `docs/user-guide.md`: how to use the app, the rules it follows, privacy, accessibility and known limits.
- `docs/decisions.md`: the decision log, version by version.
- `docs/architecture.md`: how the code is organised.

## Releases

`scripts/release.sh` builds the static site zip, `SHA256SUMS.txt`, a CycloneDX SBOM and `THIRD_PARTY_NOTICES.txt`
(run `npm ci` first; needs Python 3 and `zip`).

## Disclaimers

- Metric thresholds (Red/Amber/Green) are starting values, not a standard. Set your own policy.
- Tool and vendor names (for example Jira, Azure DevOps, Microsoft Project) are used only
  descriptively to identify file formats. They are trademarks of their respective owners, and
  this project has no affiliation with them.
- Health-status thresholds are configurable starting values, not a standard. Metrics are
  decision aids, not guarantees; verify results against your own records.

## License

Apache License 2.0. See `LICENSE` and `NOTICE`.

## Try it locally

```
npm install
npm test          # run the automated tests
npm run dev       # start the app at the address shown
npm run build     # make the static site in packages/web/dist
```
