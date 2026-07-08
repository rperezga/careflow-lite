# Deployment (self-hosted on Kali)

> Full deploy scripts land in Issue #14. This is the target design.

- **MongoDB**: systemd service, bound to `127.0.0.1` only, with auth enabled. Never exposed.
- **App**: one Node process (Express serving API + `frontend/dist`) managed by **pm2**
  (`pm2 start` + `pm2 save` + `pm2 startup`).
- **HTTPS**: **Cloudflare Tunnel** (`cloudflared`, systemd) routing
  `careflow.smectherapy.com` → `http://127.0.0.1:4000`. No router ports opened.
- Secrets live in `.env` (never committed). Demo data is seeded synthetically.
