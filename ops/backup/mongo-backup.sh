#!/usr/bin/env bash
#
# Nightly MongoDB backup for careflow-lite. Backs up the WHOLE instance, not one named database,
# so a database created next month is protected the night it appears — nobody has to remember to
# add it here. The list of things being backed up should not be a list somebody maintains by hand.
#
# Design notes (the "why", so this stays safe when someone changes it):
#   * --archive + --gzip -> ONE file per run. Rotation and integrity checks stay trivial, and
#     there is no half-written directory tree to reason about.
#   * The archive is verified with `mongorestore --dryRun` before it is kept. An archive that
#     cannot be parsed is worse than no archive: it buys false confidence.
#   * It is written as <name>.partial and renamed only after passing that check. A half-written
#     file therefore never carries a name the rest of the system trusts, and a failing run can only
#     ever delete its own temp file — never the last good archive.
#   * flock wraps the whole script (not a preflight command), so a manual run cannot collide with
#     the timer.
#   * Failure is LOUD. A backup that fails silently is the most dangerous kind: you find out on the
#     one night it matters.
#
set -euo pipefail

# --- Single instance, always. Re-exec under flock so this holds for the WHOLE run, including a
# --- manual invocation. (A previous version put flock in ExecStartPre, where it took the lock,
# --- ran `true`, and released it before the backup even started: decorative, not protective.)
LOCK="${CAREFLOW_BACKUP_LOCK:-/tmp/careflow-backup.lock}"
if [ "${_CAREFLOW_LOCKED:-0}" != "1" ]; then
  export _CAREFLOW_LOCKED=1
  exec flock -n "$LOCK" "$0" "$@"
fi

ENV_FILE="${CAREFLOW_BACKUP_ENV:-/etc/careflow/backup.env}"
[ -r "$ENV_FILE" ] || { echo "FATAL: cannot read env file: $ENV_FILE" >&2; exit 78; }
# shellcheck disable=SC1090
. "$ENV_FILE"

: "${MONGO_URI:?MONGO_URI is required in $ENV_FILE}"
: "${BACKUP_DIR:=/home/roger/backups/mongo}"
: "${RETENTION_DAYS:=7}"
LOG_FILE="${LOG_FILE:-$BACKUP_DIR/backup.log}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/mongo-all-${STAMP}.archive.gz"
PARTIAL="${ARCHIVE}.partial"

log() { printf '%s [%s] %s\n' "$(date -Is)" "${1}" "${2}" | tee -a "$LOG_FILE" >&2; }

alert() {
  if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
    return 0
  fi
  if ! curl -fsS --max-time 15 \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=$1" \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" >/dev/null; then
    log WARN "could not deliver the Telegram alert"
  fi
}

notify_failure() {
  local code=$?
  log ERROR "backup FAILED (exit $code)"
  alert "🔴 careflow: MongoDB backup FAILED on $(hostname) (exit ${code}). Check ${LOG_FILE}"
  # Only ever delete OUR temp file. A failing run must not be able to destroy the last good archive.
  rm -f "$PARTIAL"
  exit "$code"
}
trap notify_failure ERR

# Which databases are we about to protect? Logged every night, so the day a new one appears it is
# visible in the log rather than discovered during a restore.
DBS="$(mongosh "$MONGO_URI" --quiet --eval '
  db.adminCommand({ listDatabases: 1, nameOnly: true }).databases
    .map((d) => d.name)
    .filter((n) => !["admin", "config", "local"].includes(n))
    .sort()
    .join(", ")
')"
log INFO "starting full-instance backup -> $ARCHIVE"
log INFO "user databases in this instance: ${DBS:-<none>}"

# No --db: dump everything. Includes admin (so users and roles come back too, which is exactly what
# you want at 3am on the day the disk died). `local` is excluded by mongodump itself.
mongodump --uri="$MONGO_URI" --archive="$PARTIAL" --gzip --quiet

[ -s "$PARTIAL" ] || { log ERROR "dump produced an empty file"; false; }

# Integrity gate: can this archive be read back at all? --dryRun parses it without writing.
mongorestore --uri="$MONGO_URI" --archive="$PARTIAL" --gzip --dryRun --quiet
log INFO "integrity check passed (mongorestore --dryRun)"

# Promote. Only now does the file get a name the rest of the system will trust.
chmod 600 "$PARTIAL"
mv -f "$PARTIAL" "$ARCHIVE"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
SHA="$(sha256sum "$ARCHIVE" | cut -c1-16)"
log INFO "backup OK: $ARCHIVE ($SIZE, sha256:${SHA}...)"

# Rotation runs ONLY after a verified successful backup, which is what guarantees it can never
# leave the directory empty: there is always at least today's archive on disk when it runs.
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name 'mongo-all-*.archive.gz' -type f \
  -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)"
KEPT="$(find "$BACKUP_DIR" -maxdepth 1 -name 'mongo-all-*.archive.gz' -type f | wc -l)"
log INFO "rotation: removed $DELETED archive(s) older than ${RETENTION_DAYS} days; $KEPT kept"
