#!/usr/bin/env bash
#
# Restore drill. Restores the newest archive into a THROWAWAY database, compares document counts
# against the live database, prints the result, and drops the throwaway.
#
# This is the whole point of the backup system. An archive nobody has ever restored is not a
# backup, it is a hope. Running this on a schedule turns "we have backups" into a claim that is
# re-proved every week, automatically.
#
# It never touches the production database: it restores into <DB_NAME>_restore_test and drops it.
#
set -euo pipefail

ENV_FILE="${CAREFLOW_BACKUP_ENV:-/etc/careflow/backup.env}"
[ -r "$ENV_FILE" ] || { echo "FATAL: cannot read env file: $ENV_FILE" >&2; exit 78; }
# shellcheck disable=SC1090
. "$ENV_FILE"

: "${MONGO_URI:?MONGO_URI is required in $ENV_FILE}"
: "${DB_NAME:=careflow_lite}"
: "${BACKUP_DIR:=/home/roger/backups/mongo}"
LOG_FILE="${LOG_FILE:-$BACKUP_DIR/backup.log}"
TEST_DB="${DB_NAME}_restore_test"

log() { printf '%s [%s] %s\n' "$(date -Is)" "${1}" "${2}" | tee -a "$LOG_FILE" >&2; }

notify_failure() {
  local code=$?
  log ERROR "RESTORE DRILL FAILED (exit $code) — the backups may not be restorable!"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -fsS --max-time 15 \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=🔴 careflow: the RESTORE DRILL failed on $(hostname) (exit ${code}). The backups may not be restorable. Check ${LOG_FILE}" \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" >/dev/null || true
  fi
  mongosh "$MONGO_URI" --quiet --eval "db.getSiblingDB('${TEST_DB}').dropDatabase()" >/dev/null 2>&1 || true
  exit "$code"
}
trap notify_failure ERR

LATEST="$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-*.archive.gz" -type f -printf '%T@ %p\n' \
  | sort -rn | head -1 | cut -d' ' -f2-)"
[ -n "$LATEST" ] || { log ERROR "no archive found in $BACKUP_DIR"; false; }

log INFO "restore drill: restoring $LATEST into throwaway db '$TEST_DB'"

# Start from a clean slate, then rename the namespace on the way in.
mongosh "$MONGO_URI" --quiet --eval "db.getSiblingDB('${TEST_DB}').dropDatabase()" >/dev/null

mongorestore \
  --uri="$MONGO_URI" \
  --archive="$LATEST" \
  --gzip \
  --nsFrom="${DB_NAME}.*" \
  --nsTo="${TEST_DB}.*" \
  --quiet

# Compare document counts, collection by collection, live vs restored.
REPORT="$(mongosh "$MONGO_URI" --quiet --eval "
  const live = db.getSiblingDB('${DB_NAME}');
  const test = db.getSiblingDB('${TEST_DB}');
  const names = live.getCollectionNames().filter((n) => !n.startsWith('system.')).sort();
  let bad = 0;
  const rows = names.map((n) => {
    const a = live.getCollection(n).countDocuments();
    const b = test.getCollection(n).countDocuments();
    if (a !== b) bad++;
    return \`  \${n.padEnd(20)} live=\${String(a).padStart(6)}  restored=\${String(b).padStart(6)}  \${a === b ? 'OK' : 'MISMATCH'}\`;
  });
  print(rows.join('\n'));
  print(bad === 0 ? 'DRILL_RESULT=PASS' : 'DRILL_RESULT=FAIL');
")"

printf '%s\n' "$REPORT" | tee -a "$LOG_FILE"

mongosh "$MONGO_URI" --quiet --eval "db.getSiblingDB('${TEST_DB}').dropDatabase()" >/dev/null
log INFO "throwaway database '$TEST_DB' dropped"

if printf '%s' "$REPORT" | grep -q 'DRILL_RESULT=PASS'; then
  log INFO "RESTORE DRILL PASSED — $(basename "$LATEST") is restorable"
else
  log ERROR "RESTORE DRILL FAILED — document counts do not match"
  false
fi
