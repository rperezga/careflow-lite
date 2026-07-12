# Backup and restore

> **A backup nobody has ever restored is not a backup. It is a hope.**
> This system is built around that sentence: it takes a nightly dump, it refuses to keep a dump it
> cannot read back, and once a week it actually restores the newest one and checks the numbers.

MongoDB backups for careflow-lite: what runs, how to restore, and how failure is made loud.

## What runs

| When                | What                                                                                                | Unit                           |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| Every night, 03:15  | `mongodump` of `careflow_lite` → one gzipped archive, 7-day rotation                                | `careflow-backup.timer`        |
| Every Sunday, 04:00 | **Restore drill**: restore the newest archive into a throwaway DB, compare document counts, drop it | `careflow-restore-drill.timer` |

Archives live in `/home/roger/backups/mongo/` (`0700`, archives `0600`), named
`careflow_lite-YYYYMMDD-HHMMSS.archive.gz`. The log is `backup.log` in the same directory.

Both timers use `Persistent=true`: this is a home server that gets shut down, and a missed backup
must run when it comes back rather than be silently skipped.

## How failure is made loud

A backup that fails quietly is worse than no backup at all — it hands you confidence you have not
earned, and you find out on the one night it matters. So:

- Any non-zero exit sends a **Telegram alert** (if `TELEGRAM_*` is configured) and writes an
  `ERROR` line to the log.
- The dump is written as `*.archive.gz.partial` and only renamed once it has passed an integrity
  check (`mongorestore --dryRun`, which parses the archive without writing anything). A
  half-written file never gets a name the rest of the system trusts, and **a failing run can only
  delete its own temp file — never yesterday's good archive.**
- Rotation runs _only after_ a verified successful dump, so it can never empty the directory.
- The **restore drill failing is itself an alert.** That is the check that actually matters: it is
  possible to produce perfectly valid-looking archives that restore into nothing.

## Setup (once, on the server)

**1. A dedicated backup user.** Not the application user (it can write) and not `root`. If this
credential leaks, it can read the data and do nothing else.

```javascript
// mongosh, as an admin
use admin
db.createUser({
  user: "careflow_backup",
  pwd: passwordPrompt(),
  roles: [{ role: "backup", db: "admin" }, { role: "read", db: "careflow_lite" }]
})
```

**2. The environment file.** Copy `ops/backup/backup.env.example` to `/etc/careflow/backup.env`,
fill it in, and lock it down:

```bash
sudo mkdir -p /etc/careflow
sudo cp ops/backup/backup.env.example /etc/careflow/backup.env
sudo nano /etc/careflow/backup.env      # MONGO_URI with the careflow_backup password
sudo chmod 600 /etc/careflow/backup.env
sudo chown roger:roger /etc/careflow/backup.env
```

**3. The timers.**

```bash
sudo cp ops/backup/careflow-backup.{service,timer} /etc/systemd/system/
sudo cp ops/backup/careflow-restore-drill.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now careflow-backup.timer careflow-restore-drill.timer
systemctl list-timers 'careflow-*'
```

**4. Prove it works before trusting it.**

```bash
sudo systemctl start careflow-backup.service        # take one now
ls -lh /home/roger/backups/mongo/
sudo systemctl start careflow-restore-drill.service # restore it into a throwaway DB and compare
journalctl -u careflow-restore-drill.service -n 30 --no-pager
```

The drill must print `DRILL_RESULT=PASS` and a row per collection with `live == restored`.

## Restoring — the bad day

`ops/backup/mongo-restore.sh` is deliberately unhelpful about doing dangerous things by accident.
It never guesses which archive you meant, and it will not overwrite production unless you ask twice.

### Case 1 — "I need to look at yesterday's data" (safe, non-destructive)

Restores next to the live database, under a different name. **Production is untouched.**

```bash
cd ~/apps/careflow-lite
ls -lt /home/roger/backups/mongo/                       # pick an archive
./ops/backup/mongo-restore.sh /home/roger/backups/mongo/careflow_lite-20260712-031500.archive.gz
# -> restored into careflow_lite_restored
```

Inspect it in Compass, or:

```bash
mongosh "$MONGO_URI" --eval "db.getSiblingDB('careflow_lite_restored').patients.countDocuments()"
```

Drop it when you are done:

```bash
mongosh "$MONGO_URI" --eval "db.getSiblingDB('careflow_lite_restored').dropDatabase()"
```

### Case 2 — "Production is corrupted, roll it back" (destructive)

**Anything written since that archive was taken will be lost.** Stop the app first, so it cannot
write into a database that is being replaced underneath it.

```bash
pm2 stop careflow-lite

cd ~/apps/careflow-lite
./ops/backup/mongo-restore.sh /home/roger/backups/mongo/<archive>.archive.gz --production
# It prints a warning and asks you to type the database name back. That is on purpose.

pm2 start careflow-lite
curl -s https://careflow.smectherapy.com/health     # expect 200 with db:"ok"
```

Then check the app: log in, open Patients, confirm the data is the data you expected.

### Case 3 — "The whole machine is gone"

The archives live on the same disk as the database. That protects you from a bad `dropDatabase`, a
bad migration, or a corrupted collection — **it does not protect you from the disk dying.** Being
straight about the limits of a backup is part of having one.

To rebuild from nothing:

1. Reinstall MongoDB and the app (`docs/deployment-kali.md`).
2. Copy an archive back onto the machine.
3. `./ops/backup/mongo-restore.sh <archive> --production`.

If the archives are gone too, the data here is **synthetic** and can be regenerated with
`npm run seed`. That is a genuine property of this project and the reason an off-site copy was not
built: there is nothing here that cannot be recreated. **A system holding real data would need one**,
and the honest way to add it is a second target (another disk, an object store) written to by the
same script, with the same rule: it is not a backup until you have restored it.

## Troubleshooting

| Symptom                                      | Cause                                                         | Fix                                                                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `cannot read env file` (exit 78)             | `/etc/careflow/backup.env` missing or not readable by `roger` | check path, ownership and `chmod 600`                                                                                                 |
| `Authentication failed`                      | wrong password, or `authSource` missing from `MONGO_URI`      | the backup user lives in `admin` → the URI needs `?authSource=admin`                                                                  |
| `not authorized on admin to execute command` | the user lacks the `backup` role                              | re-create it as shown above                                                                                                           |
| Drill says `MISMATCH`                        | the archive does not contain what the live DB has             | **do not ignore this.** Take a fresh backup manually and run the drill again; if it still fails, the dump is not capturing everything |
| Timer never fires                            | timer not enabled                                             | `systemctl list-timers 'careflow-*'`                                                                                                  |

Everything the scripts do is logged to `/home/roger/backups/mongo/backup.log` and to the journal
(`journalctl -u careflow-backup.service`).
