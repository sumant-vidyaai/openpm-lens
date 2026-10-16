#!/usr/bin/env bash
# Builds a release bundle: the static site (zip), a SHA-256 checksum file, a CycloneDX SBOM and third-party licence notices.
# Usage: scripts/release.sh [output-folder]   (run from the repo root, after `npm ci`)
set -euo pipefail
OUT="$(realpath -m "${1:-release}")"
VERSION="$(node -p "require('./packages/web/package.json').version")"
rm -rf "$OUT" && mkdir -p "$OUT"
npm run build
python3 scripts/third-party-notices.py "$OUT/THIRD_PARTY_NOTICES.txt"
cp LICENSE NOTICE "$OUT/"
npx --yes @cyclonedx/cyclonedx-npm@4.2.1 --omit dev --output-format JSON --output-file "$OUT/sbom.cdx.json" --spec-version 1.6
(cd packages/web/dist && zip -qr -X "$OUT/openpm-lens-site-v$VERSION.zip" .)
(cd "$OUT" && sha256sum * > SHA256SUMS.txt && echo "Checksums:" && cat SHA256SUMS.txt)
