#!/usr/bin/env bash
#
# Restore an archive into a real database. This is the script you run on a bad day, so it is
# deliberately unhelpful about doing dangerous things by accident:
#
#   * It never guesses which archive you meant. You name it.
#   * Restoring OVER the production database requires --drop AND typing the database name back.
#   * By default it restores into <DB_NAME>_restored, so you can inspect before you commit.
#
# Usage:
#   ./mongo-restore.sh <archive.gz>                  # safe: restores into careflow_lite_restored
#   ./mongo-restore.sh <archive.gz> --into <db>      # restores into a database you name
#   ./mongo-restore.sh <archive.gz> --production     # OVERWRITES careflow_lite (asks first)
#
set -euo pipefail

ENV_FILE="${CAREFLOW_BACKUP_ENV:-/etc/careflow/backup.env}"
[ -r "$ENV_FILE" ] || { echo "FATAL: cannot read env file: $ENV_FILE" >&2; exit 78; }
# shellcheck disable=SC1090
. "$ENV_FILE"

: "${MONGO_URI:?MONGO_URI is required in $ENV_FILE}"
: "${DB_NAME:=careflow_lite}"

ARCHIVE="${1:-}"
[ -n "$ARCHIVE" ] && [ -r "$ARCHIVE" ] || {
  echo "usage: $0 <archive.gz> [--into <db> | --production]" >&2; exit 64;
}
shift

TARGET="${DB_NAME}_restored"
PRODUCTION=0
while [ $# -gt 0 ]; do
  case "$1" in
    --into) TARGET="${2:?--into needs a database name}"; shift 2 ;;
    --production) PRODUCTION=1; TARGET="$DB_NAME"; shift ;;
    *) echo "unknown option: $1" >&2; exit 64 ;;
  esac
done

echo "archive : $ARCHIVE"
echo "target  : $TARGET"

RESTORE_ARGS=(--uri="$MONGO_URI" --archive="$ARCHIVE" --gzip --nsFrom="${DB_NAME}.*" --nsTo="${TARGET}.*")

if [ "$PRODUCTION" -eq 1 ]; then
  cat >&2 <<WARN

  ⚠  You are about to OVERWRITE the production database '$DB_NAME'.
     Every document currently in it will be dropped and replaced by the contents of the archive.
     Anything written since that archive was taken will be lost.

WARN
  printf "  Type the database name to confirm: " >&2
  read -r CONFIRM
  [ "$CONFIRM" = "$DB_NAME" ] || { echo "  aborted." >&2; exit 1; }
  RESTORE_ARGS+=(--drop)
  echo "  confirmed. Stop the app first if it is running (pm2 stop careflow-lite)." >&2
fi

mongorestore "${RESTORE_ARGS[@]}"

echo
echo "Restored into '$TARGET'. Verify before trusting it:"
echo "  mongosh \"\$MONGO_URI\" --eval \"db.getSiblingDB('$TARGET').getCollectionNames()\""
echo "  mongosh \"\$MONGO_URI\" --eval \"db.getSiblingDB('$TARGET').patients.countDocuments()\""
