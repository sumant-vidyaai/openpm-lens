# Security and privacy

## Design promises

- The app is a static web app. Project data is read in the user's browser and is never
  sent to any server operated by this project or its host.
- No telemetry, analytics or tracking.
- No scripts, fonts or images are loaded from other websites at runtime.
- API tokens, when connectors are added, are kept in memory only and are lost when the tab
  closes, unless the user explicitly chooses otherwise.
- The release build can be downloaded as a zip and hosted internally (including offline),
  so organisations with strict rules can inspect and run it behind their own firewall.

## What the app cannot control

Browser extensions, shared computers, downloaded export files and browser caches are outside
the app's control. Treat exported project data according to your organisation's policy.

## Reporting a vulnerability

Once the repository is published, use GitHub's private vulnerability reporting
(Security tab, "Report a vulnerability"). Please do not open a public issue for security
problems. Until then, contact the maintainer directly.

This document describes design intent for an early-stage project and is not a warranty.
