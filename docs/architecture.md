# Architecture

careflow-lite is a small full-stack monorepo:

- **frontend/** — React + TypeScript + Vite + Tailwind (SPA).
- **backend/** — Node + Express + TypeScript. REST API under `/api`, plus `/health`.
- **shared/** — TypeScript types/constants shared by both.

## Data flow

- Dev: Vite dev server proxies `/api` to the backend (no CORS).
- Prod: a single Express process serves the built frontend and the API (same origin),
  fronted by Cloudflare Tunnel over HTTPS.
- Data store: MongoDB (Mongoose), self-hosted, localhost-only with auth.

## Conventions

- GitHub Flow (short-lived branches, PRs, protected `main`).
- Conventional Commits, ESLint + Prettier, CI on every push/PR.
