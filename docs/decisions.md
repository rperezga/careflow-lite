# Architecture Decision Records (ADRs)

## 2026-07 — Initial stack

- **React + TS + Vite + Tailwind** on the frontend; **Node + Express + TS** on the backend.
  Chosen to demonstrate a clean, explicit full-stack app for junior full-stack roles.
- **MongoDB + Mongoose**: reuses the MERN skillset; SQL breadth is covered by a separate
  project (closing-room, PostgreSQL).
- **Own auth** (JWT in HttpOnly cookie + roles) instead of a managed service, to demonstrate
  understanding of authentication and authorization.
- **Single Express process serves API + built frontend** in production for simple
  self-hosted deployment behind Cloudflare Tunnel.
- **Backend is CommonJS** for robust Node/pm2 execution without ESM interop friction.

## 2026-07 — Build decisions

Concrete decisions made while building the app, each meant to be defensible in a review.

- **Async error handling for Express 4.** Express 4 does not forward rejected promises to the
  error middleware, so an unexpected throw would hang the request. Routes are wrapped in a tiny
  `asyncHandler` that funnels errors to the central handler instead.
- **Validation at the edge with Zod.** Every request body/query is parsed by a Zod schema, so
  handlers work with typed, validated data and return a consistent `400` shape. Mongoose model
  hooks (e.g. _blocked → reason required_, _done → completedAt_) act as a second, invariant layer.
- **Referential integrity in the API.** MongoDB has no foreign keys, so creating a task verifies
  that the patient (and any assignee) actually exist before writing.
- **Dedicated `/status` and `/assign` endpoints for tasks.** Status changes and assignments are
  first-class operations with their own audit actions (`task.status_change`, `task.assign`), so
  the audit trail stays precise instead of a generic "updated".
- **Read-only users _directory_ separate from admin user management.** Assignment pickers and
  name resolution need a list of users, but managing users is admin-only. A minimal
  `GET /api/directory/users` (any authenticated role, no secrets) keeps least-privilege intact.
- **`toJSON` transforms on models** expose a clean `id`, drop `_id`/`__v`, and never leak the
  password hash — consistent JSON across every endpoint.
- **One `$facet` aggregation per collection for the dashboard** (instead of many `countDocuments`
  round-trips); group results are normalised to fully-keyed objects so the shape is stable even
  with no data.
- **Isolated test database per API test file.** Tests passed locally (in-memory Mongo per file)
  but a suite went red in CI because all files shared one database in the `mongo:7` service
  container. A helper now gives each file its own database — a good reminder that "green locally"
  isn't "green in CI".
- **Reused sessions in tests to respect the login rate limiter.** The login limiter (10/window)
  is shared across a test file; logging in once per role (JWT is stateless) keeps suites well
  under the limit.
- **`trust proxy` in production.** Behind the Cloudflare Tunnel the app must trust the first
  proxy so `req.ip` (and the rate limiter) see the real client, not the tunnel.
- **Design system before screens.** Visual tokens were designed in Google Stitch, then
  translated into a Tailwind theme and a small reusable component kit, so the four screens shared
  one consistent language from day one.

## 2026-07 — Incident: a health check that lied

A misconfigured deployment pointed the process at the wrong `.env`, so `MONGODB_URI` had no
credentials. MongoDB completed the connection handshake (which needs no auth) but rejected every
query with `Command find requires authentication`. Two design flaws turned a config mistake into a
silent outage:

- **`GET /health` did not touch the database**, so it happily returned `ok` while nothing worked.
- **`auth.routes` was the one route file without `asyncHandler`.** Express 4 does not forward a
  rejected promise to the error middleware, so the login request produced **no response at all** —
  the browser spun forever and Cloudflare eventually returned a `524`.

Decisions taken:

- **Health checks must prove readiness, not liveness.** `/health` now runs `dbStats`, a command that
  **requires authentication**, and returns **503** when it fails. A plain `ping` was rejected on
  purpose: MongoDB answers it without auth, so it would have reported the same false `ok`.
- **Every async route is wrapped.** `asyncHandler` was retrofitted to the auth and users routes, so a
  failing dependency yields a logged `500` instead of a hung request. A regression test asserts that
  a rejecting database makes `POST /api/auth/login` answer `500` and never hang.
- **The deployment runbook now pins an absolute `--env-file` path** and warns against a root `.env`.

## 2026-07 — A backup you have never restored is not a backup

The database had no backups. Adding `mongodump` to cron would have technically closed that gap and
would have been the wrong fix, because the failure mode that actually hurts is not "we forgot to
take a backup" — it is **"we took backups for six months and none of them restore."** So the system
is built to prove the claim rather than make it.

**Everything, including what does not exist yet.** The dump takes no `--db`: it captures the whole
instance, so a database created next month is protected the night it appears. The set of protected
databases is not a list a human maintains — which is the only kind of list that stays correct.

**The drill restores into a throwaway server, not into production.** A drill has to _write_ what it
restores. Restoring into a temporary database next to the live one — the obvious design — would mean
the nightly automation needs write and `dropDatabase` rights on the production server. _A process
whose job is to protect the data must not be able to destroy it._ So the drill starts its own
MongoDB (own port, own storage, no auth, loopback), restores there, compares counts against the live
databases **read-only**, and deletes it. The backup identity never holds more than the `backup` role.
It also proves more: restoring into a **fresh, empty server** is the real disaster scenario — new
machine, nothing on it, one file. Restoring beside a live database quietly leans on state that was
already there.

**Failure is loud.** Silence is the dangerous outcome: a backup that fails quietly hands you
confidence you did not earn, and you find out on the one night it matters. Any non-zero exit logs an
`ERROR` and pushes a Telegram alert — and the runbook includes a step that _deliberately breaks the
backup_ to watch the alarm fire, because an alarm nobody has seen go off is an alarm nobody knows
works.

**Safe under failure.** The archive is verified with `mongorestore --dryRun` before it is kept, and
written as `*.partial`, renamed only once it passes. A half-written file never carries a name the
rest of the system trusts, and a failing run can only ever delete its own temp file. Rotation runs
only after a verified success, so it cannot empty the directory.

Three of those properties exist because someone tried to break the thing:

- A test that failed the dump mid-run caught the first version **deleting yesterday's good archive**
  on its way out (same-second timestamp → same filename → the cleanup handler removed a file it had
  not created). That is where `*.partial` came from.
- Review caught `flock` sitting in `ExecStartPre`, where it took the lock, ran `true`, and released
  it _before_ the backup started. Decorative, not protective. The script now re-execs itself under
  the lock, which also covers manual runs.
- Review caught the drill being handed the **read-only** backup credential to do writes with — it
  would have failed on its first real run. That is what pushed the drill onto its own server, which
  turned out to be the better design anyway.

The scripts run unattended at 3am with nobody watching, so CI lints them like everything else:
`shellcheck` on the shell, `systemd-analyze verify` on the units.

**Known limit, stated rather than hidden:** the archives sit on the same disk as the database. That
covers a bad `dropDatabase`, a bad migration, a corrupted collection — not a dead disk. It was not
extended off-site because the data here is **synthetic and re-seedable**; nothing on that disk is
irreplaceable. A system holding real data would need a second target, and the same rule would apply
to it: it is not a backup until you have restored it.
