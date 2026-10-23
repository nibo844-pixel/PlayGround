#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROJECT_DIR="$(pwd -P)"
SRC_DIR="$PROJECT_DIR/src"
DIST_DIR="$PROJECT_DIR/dist"
export PORT="${PORT:-3000}"
WEB_DIR="${OPENCODE_WEB_DIR:-${RUNNER_TEMP:-/tmp}/omgithub-web}"
mkdir -p "$WEB_DIR"

run() {
  local label="$1"
  shift
  printf '[start] %s\n' "$label"
  /usr/bin/time -p "$@"
}

command -v node >/dev/null 2>&1 || { echo 'node is required to start this project.' >&2; exit 1; }

has_dependencies() {
  node -e 'const p=require("./package.json"); const deps={...(p.dependencies||{}),...(p.devDependencies||{})}; process.exit(Object.keys(deps).length ? 0 : 1)'
}

if [[ -f package.json ]] && has_dependencies; then
  if [[ -f package-lock.json ]]; then
    run 'install dependencies' npm ci --no-audit --no-fund
  else
    run 'install dependencies' npm install --no-audit --no-fund
  fi
else
  printf '[start] install dependencies: none declared, skipped\n'
fi

needs_build=false
if [[ ! -f "$DIST_DIR/index.html" ]]; then
  needs_build=true
elif [[ "$PROJECT_DIR/scripts/build.mjs" -nt "$DIST_DIR/index.html" ]]; then
  needs_build=true
else
  while IFS= read -r -d '' source_file; do
    if [[ "$source_file" -nt "$DIST_DIR/index.html" ]]; then
      needs_build=true
      break
    fi
  done < <(find "$SRC_DIR" -type f -print0)
fi

if [[ "$needs_build" == true ]]; then
  run 'build static app' node scripts/build.mjs
else
  printf '[start] build static app: up to date, skipped\n'
fi

[[ -f "$DIST_DIR/index.html" ]] || { echo "Build output missing: $DIST_DIR/index.html" >&2; exit 1; }

run 'write deployment metadata' env \
  PROJECT_OUT="$PROJECT_DIR" DIST_OUT="$DIST_DIR" OUT_FILE="$WEB_DIR/deployment-output.json" \
  node -e 'const fs=require("node:fs"); fs.writeFileSync(process.env.OUT_FILE, JSON.stringify({ project: process.env.PROJECT_OUT, directory: process.env.DIST_OUT }) + "\n")'

printf '[start] metadata: %s\n' "$WEB_DIR/deployment-output.json"
printf '[start] serving on port %s\n' "$PORT"
run "serve on port $PORT" node scripts/serve.mjs
