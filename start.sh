#!/bin/bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
export BACKEND_PORT="${BACKEND_PORT:-4001}"
export FRONTEND_PORT="${FRONTEND_PORT:-4000}"

fail() { echo "ERROR: $*" >&2; exit 1; }
port_is_free() { ! lsof -ti ":$1" >/dev/null 2>&1; }

echo "AI Assembly Line Visual Inspector"
echo "Preflight checks (no installs, database changes, seeding, or process termination)"

command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v pg_isready >/dev/null 2>&1 || fail "PostgreSQL client tools are required."
[ -d "$PROJECT_DIR/backend/node_modules" ] || fail "Backend dependencies are missing. Run npm install in backend explicitly."
[ -f "$PROJECT_DIR/web/package.json" ] || fail "Web client package is missing."
pg_isready -q || fail "PostgreSQL is not ready. Start it outside this launcher."
port_is_free "$BACKEND_PORT" || fail "Backend port $BACKEND_PORT is already in use."
port_is_free "$FRONTEND_PORT" || fail "Frontend port $FRONTEND_PORT is already in use."

cleanup() {
  trap - INT TERM EXIT
  [ -n "${BACKEND_PID:-}" ] && kill "$BACKEND_PID" 2>/dev/null || true
  [ -n "${FRONTEND_PID:-}" ] && kill "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(cd "$PROJECT_DIR/backend" && node src/server.js) &
BACKEND_PID=$!
(cd "$PROJECT_DIR/web" && PORT="$FRONTEND_PORT" npm start) &
FRONTEND_PID=$!

echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "Backend:  http://localhost:$BACKEND_PORT"
echo "Sign in with an account already provisioned in the database."
wait "$BACKEND_PID" "$FRONTEND_PID"
