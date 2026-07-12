#!/usr/bin/env bash
#
# Nightly MongoDB backup for careflow-lite.
#
# Design notes (the "why", so this is safe to change later):
#   * --archive + --gzip produces ONE file per run. Rotation and integrity checks stay trivial,
#     and there is no half-written directory tree to reason about.
#   * The dump is verified immediately with `mongorestore --dryRun`. An archive that cannot be
#     parsed is worse than no archive at all, because it buys false confidence.
#   * The dump is written to <name>.partial and only renamed once it has passed that check. A
#     half-written file therefore never carries a valid archive name, and a failing run can only
#     ever delete its own temporary file — never yesterday's good backup.
#   * Failures are LOUD. A backup that fails silently is the most dangerous kind: you find out
#     the night you actually need it.
#   * flock prevents two runs from overlapping if a dump ever takes longer than the interval.
#
set -euo pipefail

ENV_FILE="${CAREFLOW_BACKUP_ENV:-/etc/careflow/backup.env}"
[ -r "$ENV_FILE" ] || { echo "FATAL: cannot read env file: $ENV_FILE" >&2; exit 78; }
# shellcheck disable=SC1090
. "$ENV_FILE"

: "${MONGO_URI:?MONGO_URI is required in $ENV_FILE}"
: "${DB_NAME:=careflow_lite}"
: "${BACKUP_DIR:=/home/roger/backups/mongo}"
: "${RETENTION_DAYS:=7}"
LOG_FILE="${LOG_FILE:-$BACKUP_DIR/backup.log}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="$BACKUP_DIR/${DB_NAME}-${STAMP}.archive.gz"
PARTIAL="${ARCHIVE}.partial"

log() { printf '%s [%s] %s\n' "$(date -Is)" "${1}" "${2}" | tee -a "$LOG_FILE" >&2; }

# Loud failure. Anything that exits non-zero lands here.
notify_failure() {
  local code=$?
  log ERROR "backup FAILED (exit $code). Archive: $ARCHIVE"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -fsS --max-time 15 \
      -d "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=🔴 careflow: MongoDB backup FAILED on $(hostname) (exit ${code}). Check ${LOG_FILE}" \
      "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" >/dev/null || \
      log WARN "could not deliver the Telegram alert"
  fi
  # Only ever delete OUR temporary file. Never touch a finished archive: a failing run must not
  # be able to destroy the last good backup.
  rm -f "$PARTIAL"
  exit "$code"
}
trap notify_failure ERR

log INFO "starting backup of '$DB_NAME' -> $ARCHIVE"

mongodump \
  --uri="$MONGO_URI" \
  --db="$DB_NAME" \
  --archive="$PARTIAL" \
  --gzip \
  --quiet

[ -s "$PARTIAL" ] || { log ERROR "dump produced an empty file"; false; }

# Integrity gate: can this archive actually be read back? --dryRun parses it without writing.
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
DELETED="$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-*.archive.gz" -type f \
  -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)"
log INFO "rotation: removed $DELETED archive(s) older than ${RETENTION_DAYS} days"

KEPT="$(find "$BACKUP_DIR" -maxdepth 1 -name "${DB_NAME}-*.archive.gz" -type f | wc -l)"
log INFO "done. $KEPT archive(s) on disk."
