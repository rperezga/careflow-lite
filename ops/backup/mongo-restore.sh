#!/usr/bin/env bash
#
# Restore from an archive. This is the script you run on a bad day, so it is deliberately unhelpful
# about doing dangerous things by accident:
#
#   * It never guesses which archive you meant. You name it.
#   * By default it restores ONE database into a copy (<db>_restored), so you can look before you
#     leap. Production is untouched.
#   * Overwriting production requires --production AND typing the database name back.
#
# Usage:
#   ./mongo-restore.sh <archive.gz> --list                     # what is inside this archive?
#   ./mongo-restore.sh <archive.gz> --db careflow_lite         # -> careflow_lite_restored (safe)
#   ./mongo-restore.sh <archive.gz> --db careflow_lite --into scratch_db
#   ./mongo-restore.sh <archive.gz> --db careflow_lite --production   # OVERWRITES it (asks first)
#   ./mongo-restore.sh <archive.gz> --everything --production         # full-instance recovery
#
set -euo pipefail

ENV_FILE="${CAREFLOW_BACKUP_ENV:-/etc/careflow/backup.env}"
[ -r "$ENV_FILE" ] || { echo "FATAL: cannot read env file: $ENV_FILE" >&2; exit 78; }
# shellcheck disable=SC1090
. "$ENV_FILE"
: "${MONGO_URI:?MONGO_URI is required in $ENV_FILE}"
: "${RESTORE_MONGO_URI:=$MONGO_URI}"   # writing needs more rights than backing up: see backup.env

ARCHIVE="${1:-}"
if [ -z "$ARCHIVE" ] || [ ! -r "$ARCHIVE" ]; then
  echo "usage: $0 <archive.gz> [--list | --db <db> [--into <db>] | --everything] [--production]" >&2
  exit 64
fi
shift

DB=""; TARGET=""; PRODUCTION=0; LIST=0; EVERYTHING=0
while [ $# -gt 0 ]; do
  case "$1" in
    --list)       LIST=1; shift ;;
    --db)         DB="${2:?--db needs a database name}"; shift 2 ;;
    --into)       TARGET="${2:?--into needs a database name}"; shift 2 ;;
    --everything) EVERYTHING=1; shift ;;
    --production) PRODUCTION=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
done

if [ "$LIST" -eq 1 ]; then
  echo "Databases and collections inside $ARCHIVE:"
  mongorestore --archive="$ARCHIVE" --gzip --dryRun -v 2>&1 \
    | grep -oE 'restoring [a-zA-Z0-9_.-]+' | awk '{print "  " $2}' | sort -u
  exit 0
fi

if [ "$EVERYTHING" -eq 1 ]; then
  [ "$PRODUCTION" -eq 1 ] || { echo "--everything only makes sense with --production" >&2; exit 64; }
  cat >&2 <<'WARN'

  ⚠  FULL-INSTANCE RESTORE. Every database in the archive will be written over this server,
     including users and roles. Anything written since the archive was taken is lost.
     Stop the app first:  pm2 stop careflow-lite

WARN
  printf "  Type RESTORE EVERYTHING to confirm: " >&2
  read -r CONFIRM
  [ "$CONFIRM" = "RESTORE EVERYTHING" ] || { echo "  aborted." >&2; exit 1; }
  mongorestore --uri="$RESTORE_MONGO_URI" --archive="$ARCHIVE" --gzip --drop --nsExclude 'config.*'
  echo "Done. Start the app and verify: pm2 start careflow-lite && curl -s localhost:4000/health"
  exit 0
fi

[ -n "$DB" ] || { echo "say which database: --db <name>  (or --list to see what is in there)" >&2; exit 64; }

if [ "$PRODUCTION" -eq 1 ]; then
  TARGET="$DB"
  cat >&2 <<WARN

  ⚠  You are about to OVERWRITE the production database '$DB'.
     Every document in it is dropped and replaced by the archive's contents.
     Anything written since that archive was taken will be lost.
     Stop the app first:  pm2 stop careflow-lite

WARN
  printf "  Type the database name to confirm: " >&2
  read -r CONFIRM
  [ "$CONFIRM" = "$DB" ] || { echo "  aborted." >&2; exit 1; }
fi

TARGET="${TARGET:-${DB}_restored}"
echo "archive : $ARCHIVE"
echo "database: $DB  ->  $TARGET"

ARGS=(--uri="$RESTORE_MONGO_URI" --archive="$ARCHIVE" --gzip
      --nsInclude="${DB}.*" --nsFrom="${DB}.*" --nsTo="${TARGET}.*")
if [ "$PRODUCTION" -eq 1 ]; then
  ARGS+=(--drop)
fi

mongorestore "${ARGS[@]}"

echo
echo "Restored into '$TARGET'. Verify before trusting it:"
echo "  mongosh \"\$MONGO_URI\" --eval \"db.getSiblingDB('$TARGET').getCollectionNames()\""
