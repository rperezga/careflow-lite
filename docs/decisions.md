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
