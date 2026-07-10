# careflow-lite

![CI](https://github.com/rperezga/careflow-lite/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue)

A privacy-aware **care-operations** dashboard: a small but production-shaped full-stack app for a
care team to manage a panel of (synthetic) patients and their follow-up tasks.

> **🔴 Live demo:** **<https://careflow.smectherapy.com>**
> Sign in with `admin@example.com` / `demo-password` (also `staff@example.com` and
> `viewer@example.com`, same password, to see role-based access).
>
> Self-hosted on a Linux box behind a Cloudflare Tunnel — no cloud provider.

> ⚠️ **Synthetic data only. Not HIPAA-compliant. No real patient data.**

---

## What it does

A staff-facing internal tool with **role-based access** (admin / staff / viewer):

- **Dashboard** — aggregated snapshot (patients by risk, open / overdue / unassigned tasks,
  task breakdowns, recent activity), computed with a single MongoDB `$facet` aggregation.
- **Patients** — searchable, filterable, paginated table; create / edit in a side drawer;
  detail view; role-gated delete.
- **Care Tasks** — board and list views, filters, and a task drawer with dedicated **status**
  (blocked → reason, done → completed timestamp) and **assignment** controls.
- **Users (admin)** — manage team members, roles and active status.
- **Audit trail** — every write records an audit event; the dashboard surfaces recent activity.

Everything is gated by a cookie-based session, with **least-privilege** enforced on both the API
and the UI.

## Tech stack

| Layer    | Choices                                                                 |
| -------- | ----------------------------------------------------------------------- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router                  |
| Backend  | Node, Express, TypeScript, Mongoose, Zod, JWT (HttpOnly cookie)         |
| Database | MongoDB                                                                 |
| Testing  | Vitest, Supertest (API), React Testing Library + jsdom (UI)             |
| Tooling  | ESLint, Prettier, Husky + lint-staged, Conventional Commits             |
| CI/CD    | GitHub Actions (Mongo service container), protected `main`              |
| Ops      | Single Express process serves API + built SPA · pm2 · Cloudflare Tunnel |

## Engineering practices

This repo is built the way a small team would work, not as a one-shot dump:

- **GitHub Flow** — short-lived `feature/*` branches, one pull request per issue, protected
  `main` (merge only via green PR). 8+ feature PRs, each reviewed and squash-merged.
- **Conventional Commits** enforced by commitlint; ESLint + Prettier enforced by lint-staged.
- **CI on every push and PR** — lint, typecheck, tests (against a real `mongo:7` service
  container) and build must all pass before merge.
- **Tests everywhere** — pure calc/aggregation, API integration (Supertest), and UI (Testing
  Library). Each API test file gets an **isolated database** so suites never collide in CI.
- **Design system first** — the visual language ("Clinical Precision": calm teal, slate,
  Inter, semantic status pills) was designed in Google Stitch and translated into a Tailwind
  theme + a small reusable component kit before the screens were built.

See **[`docs/decisions.md`](docs/decisions.md)** for the decisions behind these — each one is
meant to be explainable in an interview.

## Architecture

```
Browser ──HTTPS──> Cloudflare edge ──tunnel──> Express :4000
                                                 ├─ /api/*   REST API (auth, patients, tasks, dashboard, users, directory)
                                                 ├─ /health  liveness
                                                 └─ /*        frontend/dist (SPA fallback)
                                                        │
                                              MongoDB 127.0.0.1 (auth, localhost-only)
```

- **Monorepo** (npm workspaces): `backend/`, `frontend/`, `shared/`.
- **Dev**: Vite proxies `/api` to the backend (no CORS). **Prod**: one Express process serves
  the built SPA and the API from the same origin.
- Details in **[`docs/architecture.md`](docs/architecture.md)**.

## Local development

```bash
cp .env.example backend/.env          # defaults are fine for local
npm install
# run each workspace (needs a local MongoDB, or set MONGODB_URI):
npm run dev -w @careflow/backend      # http://127.0.0.1:4000
npm run dev -w @careflow/frontend     # http://127.0.0.1:5173  (proxies /api)
npm run seed -w @careflow/backend     # synthetic demo data
```

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The exact same four checks run in CI on every push and PR.

## Deployment

Self-hosted on Kali Linux: MongoDB (localhost + auth), a single pm2-managed Node process, and a
Cloudflare Tunnel for HTTPS — no open router ports. Full runbook:
**[`docs/deployment-kali.md`](docs/deployment-kali.md)**.

## Project layout

```
backend/    Express API, models, auth, audit, tests
frontend/   React app (Vite) — screens, UI kit, design system
shared/     Shared TypeScript types/constants
docs/       architecture · decisions (ADRs) · deployment · data policy · openapi
```

## License

MIT
