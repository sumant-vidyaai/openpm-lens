# Contributing

Thank you for helping. This project is built for project managers, so clarity matters as
much as correctness.

## Ground rules (non-negotiable)

1. **No real data.** Never commit real company or personal project data, not even
   anonymised excerpts. Use synthetic samples that imitate a tool's export format.
   Column names (headers) are fine; rows are not.
2. **No network calls in the core packages, no tracking, no analytics.** Nothing may be
   loaded from another website at runtime.
3. **Never default a missing value.** A blank is `null`, not `0`. If a metric needs a
   value that is absent, report it as missing or excluded and say why.
4. **Recompute, do not trust.** Fields calculated by a source tool are stored for
   comparison only.
5. **Assumptions must be visible.** If a calculation depends on a choice, make it an
   explicit setting and describe it in the result's caveats.

## Adding a metric

1. Write the formula as a small pure function in `packages/core/src/`, with unit tests in
   `packages/core/test/`. It must return `null` when the result is undefined (for example,
   division by zero), never `NaN` or a made-up number.
2. Add a recipe card in `packages/registry/metrics/<area>/<name>.yaml` with: `id`, `name`,
   `domain`, `area`, `formula`, `meaning`, `required`, `optional`,
   `interpretation` and a `worked_example` (inputs, steps, expected, decimals).
3. Register the function for that `id` in `packages/core/src/metrics.ts`.
4. Run `npm test`. The registry test executes your worked example against your function.
5. Interpretation thresholds are **starting values, not a standard**. Say so in the card.

## Adding a tool adapter

See `docs/architecture.md` for the adapter interface. An adapter converts one tool's export
into the canonical model and must declare which canonical fields it can and cannot supply.
Include a synthetic sample file that imitates the real export format.

## Licensing of contributions

This project is licensed under Apache-2.0. By submitting a contribution you agree it is
licensed under the same terms (Apache-2.0 section 5).

## Style

Plain language in docs and messages. Explain the "why". Keep dependencies few and check
their licenses before adding them.
