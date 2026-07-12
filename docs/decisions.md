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
