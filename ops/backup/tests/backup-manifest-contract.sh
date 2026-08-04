#!/usr/bin/env bash
# Regression contract for the backup manifest and restore comparison. Version 1.1.1.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BACKUP="$ROOT/ops/backup/mongo-backup.sh"
RESTORE="$ROOT/ops/backup/verify-restore.sh"

assert_contains() {
  local file="$1" pattern="$2" label="$3"
  if ! grep -Fq -- "$pattern" "$file"; then
    printf 'FAIL %s: missing %s in %s\n' "$label" "$pattern" "$file" >&2
    return 1
  fi
  printf 'PASS %s\n' "$label"
}

assert_not_contains() {
  local file="$1" pattern="$2" label="$3"
  if grep -Fq -- "$pattern" "$file"; then
    printf 'FAIL %s: forbidden %s in %s\n' "$label" "$pattern" "$file" >&2
    return 1
  fi
  printf 'PASS %s\n' "$label"
}

assert_order() {
  local file="$1" first="$2" second="$3" label="$4"
  local first_line second_line
  first_line="$(grep -nF -- "$first" "$file" | head -1 | cut -d: -f1 || true)"
  second_line="$(grep -nF -- "$second" "$file" | head -1 | cut -d: -f1 || true)"
  if [ -z "$first_line" ] || [ -z "$second_line" ] || [ "$first_line" -ge "$second_line" ]; then
    printf 'FAIL %s: expected %s before %s\n' "$label" "$first" "$second" >&2
    return 1
  fi
  printf 'PASS %s\n' "$label"
}

assert_contains "$BACKUP" 'MANIFEST="${ARCHIVE%.archive.gz}.counts.json"' manifest_path
assert_not_contains "$BACKUP" 'countDocuments()' no_live_manifest_counts
assert_contains "$BACKUP" 'done dumping ' mongodump_count_parser
assert_order "$BACKUP" 'mongodump --uri=' 'COUNTS_DUMP_LOG=' manifest_from_dump_output
assert_contains "$RESTORE" 'MANIFEST="${LATEST%.archive.gz}.counts.json"' restore_manifest_path
assert_contains "$RESTORE" 'COMPARE_MODE=manifest' manifest_mode
assert_contains "$RESTORE" 'MISSING' manifest_missing_collection
assert_contains "$RESTORE" 'UNEXPECTED' manifest_unexpected_collection
assert_contains "$RESTORE" 'restored * 100 < live * 98' legacy_loss_threshold
assert_contains "$RESTORE" 'restored > live' legacy_corruption_threshold
assert_contains "$RESTORE" 'COMPARE_MODE=legacy' legacy_mode
assert_contains "$RESTORE" 'const restoredDbs = drill.getDBNames()' legacy_restored_database_union
assert_contains "$RESTORE" 'const cols = [...new Set([...liveCols, ...restoredCols])].sort()' legacy_collection_union
assert_contains "$RESTORE" 'MISSING_DB' manifest_missing_database
assert_contains "$RESTORE" 'UNEXPECTED_DB' manifest_unexpected_database
assert_contains "$RESTORE" 'print(bad === 0 ?' empty_exact_match_passes

node <<'JS'
function legacyStatus(live, restored) {
  if (restored > live) return "CORRUPTION";
  if (restored * 100 < live * 98) return "LOSS";
  if (restored < live) return "DRIFT_OK";
  return "OK";
}
const cases = [
  [100, 97, "LOSS"],
  [100, 98, "DRIFT_OK"],
  [100, 100, "OK"],
  [100, 101, "CORRUPTION"],
  [0, 0, "OK"],
  [0, 1, "CORRUPTION"],
];
for (const [live, restored, expected] of cases) {
  const actual = legacyStatus(live, restored);
  if (actual !== expected) throw new Error(`${live}/${restored}: expected ${expected}, got ${actual}`);
}
console.log("PASS legacy_boundary_behavior");
JS

# Exercise the real backup script with isolated fake Mongo tools. This proves that the manifest is
# emitted beside the archive with the required shape, without reading or changing a live database.
TMP="$(mktemp -d -t careflow-backup-contract-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin" "$TMP/backups"
cat >"$TMP/bin/mongodump" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
for arg in "$@"; do
  case "$arg" in --archive=*) printf 'fake archive\n' >"${arg#--archive=}";; esac
done
printf '%s\n' '2026-08-03T00:00:00.000-0400 done dumping `alpha.empty` (0 documents)' >&2
printf '%s\n' '2026-08-03T00:00:00.001-0400 done dumping `alpha.events` (10 documents)' >&2
EOF
cat >"$TMP/bin/mongorestore" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat >"$TMP/bin/mongosh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
args="$*"
if [[ "$args" == *'listDatabases'* ]]; then
  printf 'alpha\n'
else
  exec "${REAL_MONGOSH:?}" "$@"
fi
EOF
chmod +x "$TMP/bin/mongodump" "$TMP/bin/mongorestore" "$TMP/bin/mongosh"
cat >"$TMP/backup.env" <<EOF
MONGO_URI=mongodb://fake.invalid:27017
BACKUP_DIR=$TMP/backups
RETENTION_DAYS=7
LOG_FILE=$TMP/backups/backup.log
EOF
REAL_MONGOSH="$(command -v mongosh)" PATH="$TMP/bin:$PATH" CAREFLOW_BACKUP_ENV="$TMP/backup.env" _CAREFLOW_LOCKED=1 \
  bash "$BACKUP" >/dev/null
mapfile -t manifests < <(find "$TMP/backups" -maxdepth 1 -name 'mongo-all-*.counts.json' -type f)
[ "${#manifests[@]}" -eq 1 ] || { echo "FAIL generated_manifest_count=${#manifests[@]}" >&2; exit 1; }
python3 - "${manifests[0]}" <<'PY'
import json, stat, sys
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text(encoding="utf-8"))
assert data == {"alpha": {"empty": 0, "events": 10}}, data
assert stat.S_IMODE(path.stat().st_mode) == 0o600, oct(stat.S_IMODE(path.stat().st_mode))
print("PASS generated_manifest_behavior")
PY
archive="${manifests[0]%.counts.json}.archive.gz"
[ -s "$archive" ] || { echo "FAIL paired_archive_missing" >&2; exit 1; }
printf 'PASS paired_archive_name\n'

printf 'CONTRACT_RESULT=PASS\n'
