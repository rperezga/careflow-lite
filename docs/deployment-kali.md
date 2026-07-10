# Deployment — self-hosted on Kali Linux

careflow-lite runs as a single Node process behind a Cloudflare Tunnel. There is no cloud
provider and no open router ports: HTTPS is terminated by Cloudflare and the tunnel forwards
to `127.0.0.1:4000`.

```
Browser ──HTTPS──> Cloudflare edge ──tunnel──> cloudflared ──> Express :4000
                                                                 ├─ /api/*      REST API
                                                                 ├─ /health     liveness
                                                                 └─ /*          frontend/dist (SPA)
                                                                        │
                                                              MongoDB 127.0.0.1:27017 (auth)
```

- **One process**: in production Express serves both the API and the built frontend
  (`frontend/dist`) from the same origin, so there is no CORS to configure.
- **MongoDB**: localhost-only, authentication enabled, never exposed through the tunnel.
- **Process manager**: pm2 (restarts on crash, survives reboot via `pm2 startup`).
- **Secrets**: live only in `backend/.env` (chmod 600, never committed).

## Prerequisites

- Node.js 20+ and npm, git.
- `pm2` (`npm i -g pm2`).
- `cloudflared` configured for the `careflow.smectherapy.com` hostname.

## 1. MongoDB (localhost + auth)

On Kali rolling the official MongoDB APT repo fails signature verification
(`SHA1 is not considered secure since 2026-02-01` → `repository is not signed`). Use the
official **tarball** instead of APT:

```bash
# Download + install the server binaries (verify the checksum against mongodb.com)
cd /tmp
curl -LO https://fastdl.mongodb.org/linux/mongodb-linux-x86_64-debian12-7.0.15.tgz
sudo tar -xzf mongodb-linux-x86_64-debian12-7.0.15.tgz -C /opt
sudo ln -sfn /opt/mongodb-linux-x86_64-debian12-7.0.15 /opt/mongodb
sudo ln -sf /opt/mongodb/bin/mongod /usr/local/bin/mongod
mongod --version   # expect v7.0.x

sudo useradd -r -s /usr/sbin/nologin mongodb 2>/dev/null || true
sudo mkdir -p /var/lib/mongodb /var/log/mongodb
sudo chown -R mongodb:mongodb /var/lib/mongodb /var/log/mongodb
```

`/etc/mongod.conf` — bind to localhost only and enable auth:

```yaml
storage:
  dbPath: /var/lib/mongodb
systemLog:
  destination: file
  path: /var/log/mongodb/mongod.log
  logAppend: true
net:
  port: 27017
  bindIp: 127.0.0.1 # localhost ONLY — never 0.0.0.0
security:
  authorization: enabled
```

`/etc/systemd/system/mongod.service`:

```ini
[Unit]
Description=MongoDB Database Server
After=network.target

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/local/bin/mongod --config /etc/mongod.conf
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Create the application user (start once with auth off, add the user, then enable auth), or use
`mongosh` if available. Grant `readWrite` on `careflow_lite` with a strong password
(`openssl rand -base64 24`):

```javascript
use careflow_lite
db.createUser({
  user: 'careflow_app',
  pwd: '<STRONG_PASSWORD>',
  roles: [{ role: 'readWrite', db: 'careflow_lite' }],
})
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mongod
sudo ss -ltnp | grep 27017   # must show 127.0.0.1:27017 only
```

## 2. Application

```bash
git clone https://github.com/rperezga/careflow-lite ~/apps/careflow-lite
cd ~/apps/careflow-lite
```

`backend/.env` (chmod 600, never committed):

```bash
NODE_ENV=production
PORT=4000
MONGODB_URI=mongodb://careflow_app:<STRONG_PASSWORD>@127.0.0.1:27017/careflow_lite?authSource=careflow_lite
JWT_SECRET=<openssl rand -hex 32>
COOKIE_SECURE=true
```

Build and seed synthetic demo data:

```bash
npm ci
npm run build          # builds shared + backend/dist + frontend/dist
npm run seed           # synthetic users, patients and tasks (no real data)
```

## 3. Run with pm2

```bash
pm2 start backend/dist/server.js --name careflow-lite --update-env
pm2 save
pm2 startup            # run the printed command once (requires sudo) so it survives reboot
```

## 4. Cloudflare Tunnel (HTTPS)

Route the public hostname to the local app (no router ports are opened):

```
careflow.smectherapy.com  →  http://127.0.0.1:4000
```

Only the app port is tunnelled — MongoDB (27017) is never exposed.

## 5. Verify

```bash
curl -s http://127.0.0.1:4000/health          # {"status":"ok",...}
curl -sI https://careflow.smectherapy.com/     # HTTP/2 200, serves the SPA
```

Then sign in at <https://careflow.smectherapy.com> with `admin@example.com` / `demo-password`.

## Redeploy (new version)

```bash
cd ~/apps/careflow-lite
git pull
npm ci
npm run build
pm2 restart careflow-lite --update-env
# npm run seed   # only if you want to reset demo data
```

## Security notes

- MongoDB is **localhost-only with auth** and is never tunnelled.
- `JWT_SECRET` is a strong random value; `COOKIE_SECURE=true` (cookies only over HTTPS).
- `backend/.env` is `chmod 600` and git-ignored.
- All data is **synthetic** — see `docs/synthetic-data-policy.md`. Not HIPAA-compliant.
