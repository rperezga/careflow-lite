#!/usr/bin/env bash
# Version 1.2.1 — manifests use normalized counts reported by mongodump itself.
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

VERSION="1.2.1"

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
MANIFEST="${ARCHIVE%.archive.gz}.counts.json"
MANIFEST_PARTIAL="${MANIFEST}.partial"
DUMP_LOG="${ARCHIVE%.archive.gz}.mongodump.log.partial"

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
  # Only ever delete OUR temp files. A failing run must not be able to destroy the last good archive.
  rm -f "$PARTIAL" "$MANIFEST_PARTIAL" "$DUMP_LOG"
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
log INFO "mongo backup v${VERSION}: starting full-instance backup -> $ARCHIVE"
log INFO "user databases in this instance: ${DBS:-<none>}"

# No --db: dump everything. Includes admin (so users and roles come back too, which is exactly what
# you want at 3am on the day the disk died). `local` is excluded by mongodump itself. Keep the tool's
# own per-collection counts: they describe the archive, unlike a later query against a moving DB.
mongodump --uri="$MONGO_URI" --archive="$PARTIAL" --gzip 2>&1 \
  | tee -a "$LOG_FILE" "$DUMP_LOG" >&2

[ -s "$PARTIAL" ] || { log ERROR "dump produced an empty file"; false; }

# Bugfix: derive the manifest from exactly what mongodump reported writing. Counting the live DB
# after the dump has a race: a writer can add a document between the archive and the count query.
# JavaScript template literals must reach mongosh without shell expansion.
# shellcheck disable=SC2016
COUNTS_DUMP_LOG="$DUMP_LOG" COUNTS_MANIFEST="$MANIFEST_PARTIAL" mongosh --nodb --quiet --eval '
  const skip = ["admin", "config", "local"];
  const counts = {};
  let parsed = 0;
  const lines = fs.readFileSync(process.env.COUNTS_DUMP_LOG, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/done dumping (`?)([^.\s`]+)\.(.+?)\1 \(([0-9]+) documents?\)\s*$/);
    if (!match) continue;
    const [, , name, col, rawCount] = match;
    if (skip.includes(name) || col.startsWith("system.")) continue;
    counts[name] ??= {};
    if (Object.prototype.hasOwnProperty.call(counts[name], col)) {
      throw new Error(`duplicate mongodump count: ${name}.${col}`);
    }
    counts[name][col] = Number(rawCount);
    parsed++;
  }
  if (parsed === 0) throw new Error("mongodump output contained no user collection counts");
  fs.writeFileSync(process.env.COUNTS_MANIFEST, `${JSON.stringify(counts, null, 2)}\n`);
' >/dev/null
[ -s "$MANIFEST_PARTIAL" ] || { log ERROR "count manifest is empty"; false; }
# JavaScript template literals must reach mongosh without shell expansion.
# shellcheck disable=SC2016
COUNTS_MANIFEST="$MANIFEST_PARTIAL" mongosh --nodb --quiet --eval '
  const data = JSON.parse(fs.readFileSync(process.env.COUNTS_MANIFEST, "utf8"));
  if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("manifest root must be an object");
  for (const [name, cols] of Object.entries(data)) {
    if (!name || name.includes("`")) throw new Error(`invalid database name: ${name}`);
    if (!cols || Array.isArray(cols) || typeof cols !== "object") throw new Error(`invalid database entry: ${name}`);
    for (const [col, count] of Object.entries(cols)) {
      if (!col || col.includes("`")) throw new Error(`invalid collection name: ${name}.${col}`);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error(`invalid count: ${name}.${col}`);
    }
  }
' >/dev/null
chmod 600 "$MANIFEST_PARTIAL"
rm -f "$DUMP_LOG"
log INFO "count manifest parsed from mongodump output and validated -> $MANIFEST"

# Integrity gate: can this archive be read back at all? --dryRun parses it without writing.
mongorestore --uri="$MONGO_URI" --archive="$PARTIAL" --gzip --dryRun --quiet
log INFO "integrity check passed (mongorestore --dryRun)"

# Promote the manifest first, then the archive. An interrupted promotion can leave an orphaned
# manifest, which the drill ignores; it must never leave a newly trusted archive without its
# already-complete manifest.
chmod 600 "$PARTIAL"
mv -f "$MANIFEST_PARTIAL" "$MANIFEST"
mv -f "$PARTIAL" "$ARCHIVE"

SIZE="$(du -h "$ARCHIVE" | cut -f1)"
SHA="$(sha256sum "$ARCHIVE" | cut -c1-16)"
log INFO "backup OK: $ARCHIVE ($SIZE, sha256:${SHA}...); manifest=$MANIFEST"

# Rotation runs ONLY after a verified successful backup, which is what guarantees it can never
# leave the directory empty: there is always at least today's archive on disk when it runs.
DELETED=0
while IFS= read -r old_archive; do
  rm -f "${old_archive%.archive.gz}.counts.json"
  rm -f "$old_archive"
  DELETED=$((DELETED + 1))
done < <(find "$BACKUP_DIR" -maxdepth 1 -name 'mongo-all-*.archive.gz' -type f \
  -mtime "+${RETENTION_DAYS}" -print)
KEPT="$(find "$BACKUP_DIR" -maxdepth 1 -name 'mongo-all-*.archive.gz' -type f | wc -l)"
log INFO "rotation: removed $DELETED archive(s) older than ${RETENTION_DAYS} days; $KEPT kept"
