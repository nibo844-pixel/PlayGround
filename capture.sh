#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

: "${CAPTURE_URL:?Set CAPTURE_URL to the exact app URL.}"
: "${CAPTURE_DIR:?Set CAPTURE_DIR to a directory outside the source tree.}"

run() {
  local label="$1"
  shift
  printf '[capture] %s\n' "$label"
  /usr/bin/time -p "$@"
}

run 'prepare capture directory' mkdir -p "$CAPTURE_DIR"
run 'render desktop and mobile views' node scripts/capture.mjs

for view in desktop mobile; do
  [[ -f "$CAPTURE_DIR/final-$view.png" ]] || { echo "Missing capture: $CAPTURE_DIR/final-$view.png" >&2; exit 1; }
done
printf '[capture] wrote %s/final-desktop.png and %s/final-mobile.png\n' "$CAPTURE_DIR" "$CAPTURE_DIR"
