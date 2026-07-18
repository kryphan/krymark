# Contributing

## Dev setup

```bash
npm install
# PocketBase: download the binary from pocketbase.io (or docker compose up pocketbase)
./pocketbase serve --dir ./pb_data --hooksDir ./pb/pb_hooks
./pocketbase superuser upsert dev@local.test devpassword123 --dir ./pb_data
PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=dev@local.test PB_ADMIN_PASS=devpassword123 npm run setup
PB_URL=http://127.0.0.1:8090 PB_ADMIN_EMAIL=dev@local.test PB_ADMIN_PASS=devpassword123 node pb/gen-superuser-token.mjs
# put the token in .env (copy .env.example), then:
npm run dev
```

## Before a PR

- `npm run typecheck` and `npm run build` must pass. The widget is type-checked by the Next build — esbuild alone won't catch TS errors.
- If you touched collections/rules: update `pb/setup-collections.mjs` (keep it **idempotent**) and run the isolation test:
  `PB_URL=… PB_ADMIN_EMAIL=… PB_ADMIN_PASS=… node pb/tests/rules_test.mjs` — 42 assertions, must all pass.
- Widget changes: keep it dependency-free, Shadow-DOM-contained, and mind the size (`npm run build:widget && gzip -c public/w.js | wc -c` — stay well under 35KB).
- Anything reporter-facing must **never surface technical errors** — degrade silently, keep the note deliverable.

## Style

- TypeScript strict, no new runtime deps without a strong reason.
- Optional integrations must no-op cleanly when their env vars are absent.
- UI follows the existing token system in `globals.css` (Geist, near-black monochrome, one accent color).
