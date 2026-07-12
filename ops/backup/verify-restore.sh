#!/usr/bin/env bash
#
# Restore drill — the whole point of the backup system.
#
# It restores the newest archive into a THROWAWAY MongoDB instance (its own port, its own dbpath,
# no auth, loopback only), compares document counts collection by collection against the live
# databases, and then deletes the instance entirely.
#
# Why a separate instance instead of a temporary database on the production server:
#
#   * The drill needs to WRITE what it restores. If it wrote into production, its credential would
#     need write and dropDatabase rights there — which means a bug in this script could damage the
#     live data. Instead, its production credential stays READ-ONLY, and everything it writes goes
#     into a mongod that is deleted minutes later. A drill must not be able to hurt what it is
#     protecting.
#   * It also proves more. Restoring into a FRESH, empty mongod is the actual disaster scenario:
#     new machine, nothing there, only this file. Restoring next to a live database would quietly
#     lean on state that already existed.
#
# It discovers the databases dynamically, so a database created next month is drilled the first
# Sunday after it appears. Nobody has to remember to add it here.
#
set -euo pipefail

ENV_FILE="${CAREFLOW_BACKUP_ENV:-/etc/careflow/backup.env}"
[ -r "$ENV_FILE" ] || { echo "FATAL: cannot read env file: $ENV_FILE" >&2; exit 78; }
# shellcheck disable=SC1090
. "$ENV_FILE"

: "${MONGO_URI:?MONGO_URI is required in $ENV_FILE}"
: "${BACKUP_DIR:=/home/roger/backups/mongo}"
: "${DRILL_PORT:=27099}"
LOG_FILE="${LOG_FILE:-$BACKUP_DIR/backup.log}"

SCRATCH_DIR=""
MONGOD_PID=""
DRILL_URI="mongodb://127.0.0.1:${DRILL_PORT}/?directConnection=true"

log() { printf '%s [%s] %s\n' "$(date -Is)" "${1}" "${2}" | tee -a "$LOG_FILE" >&2; }

alert() {
  if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
    return 0
  fi
  curl -fsS --max-time 15 -d "chat_id=${TELEGRAM_CHAT_ID}" --data-urlencode "text=$1" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" >/dev/null || true
}

cleanup() {
  if [ -n "$MONGOD_PID" ] && kill -0 "$MONGOD_PID" 2>/dev/null; then
    mongosh "$DRILL_URI" --quiet --eval 'db.getSiblingDB("admin").shutdownServer({force:true})' \
      >/dev/null 2>&1 || kill "$MONGOD_PID" 2>/dev/null || true
    # Give it 10s to go down on its own before reaching for -9.
    for _ in {1..20}; do kill -0 "$MONGOD_PID" 2>/dev/null || break; sleep 0.5; done
    kill -9 "$MONGOD_PID" 2>/dev/null || true
  fi
  if [ -n "$SCRATCH_DIR" ] && [ -d "$SCRATCH_DIR" ]; then
    rm -rf "$SCRATCH_DIR"
  fi
  return 0
}

on_error() {
  local code=$?
  log ERROR "RESTORE DRILL FAILED (exit $code) — the backups may not be restorable!"
  alert "🔴 careflow: the RESTORE DRILL failed on $(hostname) (exit ${code}). The backups may not be restorable. Check ${LOG_FILE}"
  cleanup
  exit "$code"
}
trap on_error ERR
trap cleanup EXIT

command -v mongod >/dev/null || { log ERROR "mongod not found on PATH"; false; }

LATEST="$(find "$BACKUP_DIR" -maxdepth 1 -name 'mongo-all-*.archive.gz' -type f -printf '%T@ %p\n' \
  | sort -rn | head -1 | cut -d' ' -f2-)"
[ -n "$LATEST" ] || { log ERROR "no archive found in $BACKUP_DIR"; false; }

log INFO "restore drill: $(basename "$LATEST")"

# --- 1. A throwaway MongoDB, on its own port, with its own storage, reachable only from loopback.
SCRATCH_DIR="$(mktemp -d -t careflow-drill-XXXXXX)"
mkdir -p "$SCRATCH_DIR/data"
mongod --dbpath "$SCRATCH_DIR/data" --port "$DRILL_PORT" --bind_ip 127.0.0.1 \
  --logpath "$SCRATCH_DIR/mongod.log" --wiredTigerCacheSizeGB 0.25 --fork >/dev/null
MONGOD_PID="$(pgrep -f "dbpath $SCRATCH_DIR/data" | head -1)"
[ -n "$MONGOD_PID" ] || { log ERROR "the throwaway mongod did not start; see $SCRATCH_DIR/mongod.log"; false; }

for _ in {1..30}; do
  mongosh "$DRILL_URI" --quiet --eval 'db.adminCommand({ping:1})' >/dev/null 2>&1 && break
  sleep 1
done
mongosh "$DRILL_URI" --quiet --eval 'db.adminCommand({ping:1})' >/dev/null
log INFO "throwaway mongod up on 127.0.0.1:${DRILL_PORT} (pid $MONGOD_PID, dbpath $SCRATCH_DIR/data)"

# --- 2. Restore the archive into it. This is the real thing: an empty server and one file.
mongorestore --uri="$DRILL_URI" --archive="$LATEST" --gzip --nsExclude 'config.*' --quiet
log INFO "archive restored into the throwaway instance"

# --- 3. Compare, database by database, collection by collection. Discovered dynamically, so a new
# ---    database is covered without anyone editing this script.
REPORT="$(mongosh "$MONGO_URI" --quiet --eval "
  const drill = Mongo('127.0.0.1:${DRILL_PORT}');
  const skip = ['admin', 'config', 'local'];
  const dbs = db.adminCommand({ listDatabases: 1, nameOnly: true }).databases
    .map((d) => d.name).filter((n) => !skip.includes(n)).sort();
  let bad = 0, checked = 0;
  const out = [];
  for (const name of dbs) {
    const live = db.getSiblingDB(name);
    const rest = drill.getDB(name);
    const cols = live.getCollectionNames().filter((c) => !c.startsWith('system.')).sort();
    if (cols.length === 0) { out.push(\`  \${name}: (no collections)\`); continue; }
    out.push(\`  \${name}\`);
    for (const c of cols) {
      const a = live.getCollection(c).countDocuments();
      const b = rest.getCollection(c).countDocuments();
      checked++;
      if (a !== b) bad++;
      out.push(\`    \${c.padEnd(22)} live=\${String(a).padStart(7)}  restored=\${String(b).padStart(7)}  \${a === b ? 'OK' : 'MISMATCH'}\`);
    }
  }
  if (dbs.length === 0) out.push('  (no user databases found — nothing to drill)');
  print(out.join('\n'));
  print(\`DRILL_SUMMARY databases=\${dbs.length} collections=\${checked} mismatches=\${bad}\`);
  print(bad === 0 && checked > 0 ? 'DRILL_RESULT=PASS' : 'DRILL_RESULT=FAIL');
")"

printf '%s\n' "$REPORT" | tee -a "$LOG_FILE"

if printf '%s' "$REPORT" | grep -q 'DRILL_RESULT=PASS'; then
  log INFO "RESTORE DRILL PASSED — $(basename "$LATEST") restores into an empty server, intact"
else
  log ERROR "RESTORE DRILL FAILED — the restored data does not match the live data"
  false
fi
