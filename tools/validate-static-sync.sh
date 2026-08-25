#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT_TEST=10001
BACKUP_DIR="$(mktemp -d /tmp/kytto-public-backup.XXXXXX)"
SERVER_PID=""
cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -rf "$ROOT/app/public"
  mv "$BACKUP_DIR/public" "$ROOT/app/public"
  rmdir "$BACKUP_DIR" 2>/dev/null || true
}
trap cleanup EXIT

printf '%s\n' '=== build frontend ==='
(cd web && npm run build)

mv "$ROOT/app/public" "$BACKUP_DIR/public"
mkdir -p "$ROOT/app/public"
cp -R "$ROOT/web/dist/." "$ROOT/app/public/"
cp "$BACKUP_DIR/public/sw.js" "$ROOT/app/public/sw.js"

printf '%s\n' '=== static shell ==='
grep -E '<title>|meta name="description"|<script type="module"|<link rel="stylesheet"' app/public/index.html | head -10
printf '%s\n' '=== server smoke ==='
NODE_ENV=development PORT="$PORT_TEST" DB_PATH="/tmp/kytto-static-sync-db.json" node app/server.js > /tmp/kytto-static-sync-server.log 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT_TEST}/api/info" >/tmp/kytto-static-sync-info.json 2>/dev/null; then break; fi
  sleep 1
done
curl -fsS -o /tmp/kytto-static-sync-home.html -w 'home_status=%{http_code} home_size=%{size_download}\n' "http://127.0.0.1:${PORT_TEST}/?locale=pt-BR"
curl -fsS -o /tmp/kytto-static-sync-admin.html -w 'admin_status=%{http_code} admin_size=%{size_download}\n' "http://127.0.0.1:${PORT_TEST}/admin"
curl -fsS -o /tmp/kytto-static-sync-info.json -w 'info_status=%{http_code} info_size=%{size_download}\n' "http://127.0.0.1:${PORT_TEST}/api/info"
grep -q 'Kytto | Sistemas inteligentes para negócios' /tmp/kytto-static-sync-home.html
printf '%s\n' 'static_sync=ok'
printf '%s\n' '=== server log ==='
tail -20 /tmp/kytto-static-sync-server.log
