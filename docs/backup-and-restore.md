# Backup and restore

> **A backup nobody has ever restored is not a backup. It is a hope.**
> This system is built around that sentence. It dumps the whole MongoDB instance every night, it
> refuses to keep an archive it cannot read back, and once a week it **actually restores the newest
> one into a fresh, empty MongoDB and counts the documents.**

## What runs

| When           | What                                                                                                                                     | Unit                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Nightly, 03:15 | `mongodump` of the **entire instance** → one gzipped archive; 7-day rotation                                                             | `careflow-backup.timer`        |
| Sundays, 04:00 | **Restore drill** — restore the newest archive into a throwaway MongoDB, compare document counts against every live database, destroy it | `careflow-restore-drill.timer` |

Archives: `/home/roger/backups/mongo/mongo-all-YYYYMMDD-HHMMSS.archive.gz` (dir `0700`, files
`0600`). Log: `backup.log` in the same directory, plus the journal.

Both timers use `Persistent=true` — this host gets shut down, and a missed backup must run when it
comes back rather than be silently skipped.

## Every database, including the ones that do not exist yet

The dump takes **no `--db` flag**, so it captures the whole instance: every database present today,
every database created next month, plus users and roles from `admin` (which is exactly what you
want at 3am on the day the disk died). The drill discovers databases dynamically and checks all of
them.

The set of protected databases is therefore **not a list somebody maintains by hand** — which is
the only kind of list that stays correct. Each night the log records what it found:

```
[INFO] user databases in this instance: careflow_lite
```

The day a new database appears there, it is already being backed up and will be drilled that Sunday.

## The drill runs against a throwaway server, not production

The drill has to **write** what it restores. The obvious design — restore into a temporary database
next to the live one — would mean the automation needs write and `dropDatabase` rights on the
production server. **A process whose job is to protect the data must not be able to destroy it.**

So instead the drill starts its own MongoDB: its own port, its own storage directory, no auth,
loopback only. It restores the archive there, compares counts against the live databases
(**read-only**), then shuts it down and deletes the directory. The backup identity never holds more
than the `backup` role.

It also proves more. Restoring into a **fresh, empty server** is the actual disaster scenario — new
machine, nothing on it, one file. Restoring next to a live database would quietly lean on state
that already happened to be there.

## How failure is made loud

A backup that fails quietly is worse than no backup at all: it hands you confidence you have not
earned, and you find out on the one night it matters.

- Any non-zero exit logs `ERROR` and pushes a **Telegram alert**.
- The dump is verified with `mongorestore --dryRun` (parses the archive without writing) **before it
  is kept**. An unreadable archive is deleted and the run fails.
- It is written as `*.partial` and renamed only after passing that check — so a half-written file
  never carries a name the rest of the system trusts, and **a failing run can only ever delete its
  own temp file, never the last good archive.**
- Rotation runs _only after_ a verified successful dump, so it can never empty the directory.
- The script re-execs itself under `flock`, so the timer and a manual run cannot collide.
- **The drill failing is itself an alert.** It is the only check that catches an archive that is
  perfectly valid and restores into nothing.

## Setup (once, on the server)

**1. A read-only backup user.** Not the application user (it can write), not `root`.

```javascript
// mongosh, as an admin
use admin
db.createUser({
  user: "careflow_backup",
  pwd: passwordPrompt(),
  roles: [{ role: "backup", db: "admin" }]   // covers every database, present and future
})
```

**2. The environment file.**

```bash
sudo mkdir -p /etc/careflow
sudo cp ops/backup/backup.env.example /etc/careflow/backup.env
sudo nano /etc/careflow/backup.env          # MONGO_URI (with ?authSource=admin), Telegram token
sudo chown roger:roger /etc/careflow/backup.env
sudo chmod 600 /etc/careflow/backup.env
```

**3. The timers.**

```bash
sudo cp ops/backup/careflow-backup.{service,timer} /etc/systemd/system/
sudo cp ops/backup/careflow-restore-drill.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now careflow-backup.timer careflow-restore-drill.timer
systemctl list-timers 'careflow-*'
```

**4. Prove it, before trusting it.**

```bash
sudo systemctl start careflow-backup.service
ls -lh /home/roger/backups/mongo/

sudo systemctl start careflow-restore-drill.service
journalctl -u careflow-restore-drill.service -n 40 --no-pager
```

The drill must print a row per collection with `live == restored`, and `DRILL_RESULT=PASS`.

**5. Prove the alarm works too.** An alerting system you have never seen fire is an alerting system
you do not know works.

```bash
cp /etc/careflow/backup.env /tmp/broken.env
sed -i 's/@127.0.0.1/@no-such-host/' /tmp/broken.env
CAREFLOW_BACKUP_ENV=/tmp/broken.env ./ops/backup/mongo-backup.sh ; echo "exit=$?"
# expect: non-zero exit, an ERROR line in the log, a Telegram alert — and every existing
# archive still on disk, untouched.
rm /tmp/broken.env
```

## Restoring — the bad day

`ops/backup/mongo-restore.sh` is deliberately unhelpful about doing dangerous things by accident.

Writing needs more rights than backing up, so the restore script reads `RESTORE_MONGO_URI` — a
separate, stronger credential. Leaving it unset is fine and even preferable: a human runs this
script, and a human can supply an admin URI at that moment. **What you do not want is the nightly
automation holding a credential that can drop your database.**

### "What is even in this archive?"

```bash
./ops/backup/mongo-restore.sh /home/roger/backups/mongo/<archive> --list
```

### Case 1 — "I need to see yesterday's data" (safe; production untouched)

```bash
./ops/backup/mongo-restore.sh <archive> --db careflow_lite
# -> restored into careflow_lite_restored. Open it in Compass, compare, then drop it:
mongosh "$MONGO_URI" --eval "db.getSiblingDB('careflow_lite_restored').dropDatabase()"
```

### Case 2 — "Production is corrupted; roll it back" (destructive)

Anything written since that archive was taken is **lost**. Stop the app first, so it cannot write
into a database that is being replaced underneath it.

```bash
pm2 stop careflow-lite
./ops/backup/mongo-restore.sh <archive> --db careflow_lite --production
#   ^ prints a warning and makes you type the database name back. On purpose.
pm2 start careflow-lite
curl -s https://careflow.smectherapy.com/health      # expect 200, db:"ok"
```

Then log in and look at the data with your own eyes before you call it done.

### Case 3 — "The machine is gone"

```bash
# 1. Rebuild the host: docs/deployment-kali.md
# 2. Copy an archive back onto it.
# 3. Full-instance recovery — databases, users and roles:
pm2 stop careflow-lite
./ops/backup/mongo-restore.sh <archive> --everything --production
pm2 start careflow-lite
```

**The honest limit:** the archives live on the same disk as the database. That covers a bad
`dropDatabase`, a bad migration, a corrupted collection — **it does not cover the disk dying.**
Saying so plainly is part of having a backup rather than a feeling.

Off-site copies were not built because **the data here is synthetic and re-seedable** (`npm run
seed`): there is nothing on that disk that cannot be recreated. A system holding real data would
need a second target — another disk, an object store — and exactly the same rule would apply to it:
_it is not a backup until you have restored it._

## Troubleshooting

| Symptom                            | Cause                                                       | Fix                                                                                                                                                                            |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| exit 78, `cannot read env file`    | `/etc/careflow/backup.env` missing or unreadable by `roger` | check path, owner, `chmod 600`                                                                                                                                                 |
| `Authentication failed`            | wrong password, or no `authSource`                          | the backup user lives in `admin` → the URI needs `?authSource=admin`                                                                                                           |
| `not authorized ... listDatabases` | missing the `backup` role                                   | re-create the user as above                                                                                                                                                    |
| Drill: `mongod not found on PATH`  | MongoDB installed under `/opt` without a symlink            | link it into `/usr/local/bin`                                                                                                                                                  |
| Drill: **MISMATCH**                | the archive does not contain what the live DB has           | **do not ignore this.** Take a fresh backup by hand, run the drill again. If it still fails, the dump is not capturing everything — that is the whole reason this drill exists |
| Timer never fires                  | not enabled                                                 | `systemctl list-timers 'careflow-*'`                                                                                                                                           |
