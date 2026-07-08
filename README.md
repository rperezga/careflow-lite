# careflow-lite

![CI](https://github.com/rperezga/careflow-lite/actions/workflows/ci.yml/badge.svg)

A privacy-aware **care operations** demo for tracking synthetic patients and follow-up tasks.

> **Synthetic data only. Not HIPAA-compliant. No real patient data.**

## Stack

- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node + Express + TypeScript
- Database: MongoDB + Mongoose
- Tests: Vitest + Supertest (API), React Testing Library (UI)
- Ops: pm2 + Cloudflare Tunnel (self-hosted)

## Monorepo layout

```
backend/    Express API + /health
frontend/   React app (Vite)
shared/     Shared TypeScript types
docs/       Architecture, decisions (ADRs), deployment, data policy
```

## Local setup

```bash
cp .env.example .env
npm install
npm run dev        # backend + frontend (run per workspace)
```

## Quality

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Every push and PR runs the same checks in CI (GitHub Actions). `main` is protected:
changes land via pull request.

## Status

MVP in progress — see the [project board](https://github.com/users/rperezga/projects/1)
and the `MVP` milestone.

## License

MIT
