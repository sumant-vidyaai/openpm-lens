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
6. Add a matching entry to `TERMS` in `packages/web/src/learnContent.ts` with the **same
   formula text** as the card, a plain-language meaning, a worked example and a caution.
   A test (`packages/registry/test/registry.test.ts`) fails if a card's formula is not
   taught on the Learn tab, so the app and its teaching cannot drift apart.
7. Say where the formula came from. Confirm it from an independent source (a standard or a
   published guide), not from memory, and check your test numbers by hand or with a
   separate calculation, not by running the code you wrote.

## Getting started

You need Node.js 22 (the version the automatic checks use).

```
npm install
npm test            # all tests, about a minute at most
npx tsc --noEmit    # type check core and registry
cd packages/web && npx tsc --noEmit -p . && cd ../..   # type check the app
npm run build       # production build in packages/web/dist
```

The code is in three parts: `packages/core` (the calculations, no screen code),
`packages/registry` (the metric cards) and `packages/web` (the app). Calculations belong in
`core` so they can be tested without a browser. The app only shows what `core` works out.

## Before you open a pull request

- Tests pass, and new behaviour has tests whose expected numbers were worked out by hand.
- A missing value stays missing: no `0`, no guess. Anything left out is listed on screen.
- Screens work with the keyboard, in light and dark, and at 360 px wide with no sideways
  scrolling. Run an automated accessibility check (axe-core) on any new tab.
- Nothing is loaded from another website and nothing leaves the browser. The content
  security policy forbids inline styles and scripts, so use CSS classes.
- Docs are updated: `docs/user-guide.md` for anything a person will see, and
  `docs/decisions.md` for any choice that someone might later ask "why".
- State the limits of your change. Saying what it does not do is part of the work.

## Reporting a problem

Describe the steps and what you expected. Do not attach real project files: a few
made-up rows that show the problem are enough. Security problems go through `SECURITY.md`,
not a public issue.

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
