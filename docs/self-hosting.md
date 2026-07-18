# Self-hosting KryMark

Everything runs from one `docker compose` stack: the Next.js app and PocketBase. SQLite storage, no external database.

## Requirements

- Docker + Docker Compose v2
- Node 20+ on the machine you run setup scripts from (they just call the PocketBase HTTP API)
- A domain pointing at the box (optional for local/LAN use)

## Install

```bash
git clone https://github.com/kryphan/krymark && cd krymark
cp .env.example .env
```

Edit `.env` — the required trio:

| Var | What |
|---|---|
| `NEXT_PUBLIC_APP_ORIGIN` | Public URL of the instance, e.g. `https://feedback.yourdomain.com`. Used in emails, snippets, prompts and re-review links. Build-time var — change requires rebuild. |
| `IP_HASH_SALT` | `openssl rand -hex 16`. Salts IP hashes (rate limiting) and signs re-review links. |
| `PB_SUPERUSER_TOKEN` | Fill after step 3 below. |

Then:

```bash
docker compose up -d --build

# 1) PocketBase superuser (only used for admin + token generation)
docker exec krymark-pb /pb/pocketbase superuser upsert admin@example.com 'A-STRONG-PASSWORD' --dir /pb/pb_data

# 2) collections + multi-tenant API rules (idempotent — safe to rerun any time)
PB_URL=http://127.0.0.1:8091 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASS='A-STRONG-PASSWORD' npm run setup

# 3) app token → paste into .env as PB_SUPERUSER_TOKEN
PB_URL=http://127.0.0.1:8091 PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASS='A-STRONG-PASSWORD' node pb/gen-superuser-token.mjs

docker compose up -d --build app   # restart app with the token baked in
```

Open the app, sign up — the first account gets its own org automatically.

## Reverse proxy / TLS

The app listens on `${APP_PORT:-3000}`. Put any proxy in front:

**nginx-proxy + acme-companion** — copy the shipped example:

```bash
cp docker-compose.proxy.example.yml docker-compose.override.yml
# edit VIRTUAL_HOST/LETSENCRYPT_HOST + the external network name, then:
docker compose up -d
```

The override file is **gitignored by design** — your proxy config survives `git pull` and redeploys.

**Caddy** (simplest standalone):

```
feedback.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
```

Set `APP_PORT=127.0.0.1:3000` in `.env` so the app port isn't exposed publicly.

## PocketBase admin UI

Bound to `127.0.0.1:${PB_ADMIN_PORT:-8091}` only. Reach it through an SSH tunnel:

```bash
ssh -L 8091:127.0.0.1:8091 your-server   # then open http://127.0.0.1:8091/_/
```

You rarely need it — day-to-day admin happens in the KryMark dashboard.

## Backups

`ops/backup-pb.sh` snapshots PocketBase via its backup API and keeps the 7 newest archives in `pb-data/backups/`:

```bash
# /etc/cron.d/krymark-backup
0 3 * * * root /path/to/krymark/ops/backup-pb.sh >> /var/log/krymark-backup.log 2>&1
```

Restore = stop the stack, unzip a backup over `pb-data/`, start again. If you use S3 for screenshots, images live in your bucket independently.

## Weekly digest (optional)

Set `CRON_SECRET` in `.env` and add a weekly cron that pings the app — each org owner gets one summary email (needs SES):

```
# /etc/cron.d/krymark-digest — Mondays 8am
0 8 * * 1 root curl -sf -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR-KRYMARK/api/cron/digest
```

## Upgrades

```bash
git pull
npm run setup     # applies any new collections/rules — idempotent
docker compose up -d --build app
```

## Monitoring

`GET /api/health` returns `{ok, app, pb}` — **HTTP 503 when PocketBase is down**, 200 otherwise. Point Uptime Kuma / Pingdom / anything at it.

## Optional integrations

All degrade gracefully when unset (see `.env.example`):

- **S3** — screenshots uploaded to `s3://$S3_BUCKET/shots/<random>.webp` with public-read on that prefix; their URLs are embedded in AI prompts so vision-capable editors can fetch them. Without S3, screenshots are stored inside PocketBase and proxied by the app (auth-checked, not embeddable in prompts).
- **SES** — resolve notifications, the reporter re-review loop and password-reset emails. Any SES account works; `SES_CONFIG_SET` optional.
- **Telegram** — a bot message on every new note (`TG_BOT_TOKEN` + `TG_CHAT_ID`).

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| App 503 on /api/health | PocketBase container down — `docker logs krymark-pb` |
| Widget sends fail with 401/500 | `PB_SUPERUSER_TOKEN` missing/expired — regenerate (step 3) and rebuild app |
| Screenshots never attach | Check the browser can reach `<origin>/vendor/snapdom.mjs` (CSP `script-src` must allow your KryMark origin) |
| Emails not sending | SES env unset (by design silent) or sender not verified in SES |
| Reverse proxy 502 right after deploy | Reload your proxy after container recreation (nginx-proxy: `docker exec nginx-proxy nginx -s reload`) |
