# Deployment

## Components

| Component | Suggested host | Notes |
|---|---|---|
| Web + API | Render, Railway, Fly.io or any Node 20+ host; Vercel also works | One Next.js process (`pnpm build` then `pnpm --filter @sukkot/web start`) |
| PostgreSQL 16 | Neon, Render, Supabase, RDS | Enable automated daily backups and point-in-time recovery |
| File storage | Cloudflare R2, AWS S3, Backblaze B2 | Two prefixes: `public/` (resized images) and `private/` (documents). The bucket itself must not be public; expose only `public/` through a CDN if you set `STORAGE_PUBLIC_BASE_URL` |
| Email | Resend (`EMAIL_DRIVER=resend`) | Verify your sending domain |
| Mobile | EAS Build → Google Play / App Store | Set `EXPO_PUBLIC_API_URL` to the production HTTPS URL |

## Recommended setup: Render (Frankfurt)

The repository includes a Render Blueprint (`render.yaml`) that creates:

- `sukkot-web`: the web app and API (Node 22, Starter plan). Database migrations run before each
  deploy (`preDeployCommand`), and Render health-checks `/api/health`.
- `sukkot-expire`: a cron job that runs `jobs:expire` every 15 minutes.
- `sukkot-db`: PostgreSQL 16 on a paid plan, so it has daily backups and point-in-time recovery.

Everything is in the Frankfurt region. Photos and documents go to Cloudflare R2, email goes through
Resend, and Cloudflare handles the domain.

### Before you start

1. **Cloudflare R2**: create a bucket (for example `sukkot-files`), then an R2 API token with
   read and write access to that bucket only. Note the account endpoint
   (`https://<account-id>.r2.cloudflarestorage.com`), access key ID and secret.
2. **Resend**: add and verify your sending domain, then create an API key.
3. **Domain**: decide the address, for example `https://sukkotsalone.com`.

### Create the services

1. In Render, choose **New > Blueprint**, connect GitHub and pick the Sukkot repository.
2. Render lists the three resources and asks for the values marked `sync: false`. Fill in:
   - `APP_URL`: your final address, with `https://`
   - `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`: from R2
   - `EMAIL_FROM` and `RESEND_API_KEY`: from Resend
   - Leave `STORAGE_PUBLIC_BASE_URL` and all Orange Money and Afrimoney values empty for now.

   `APP_SECRET` is generated for you. `PAYMENT_METHODS_ENABLED` starts as bank transfer, cash and
   manual records only.
3. Apply the Blueprint. The first deploy builds the app and creates the database tables.

### Load reference data and create the first admin

Open the `sukkot-web` service, then **Shell**, and run:

```bash
pnpm db:seed                               # locations, property types, amenities, plans (no demo data in production)
pnpm --filter @sukkot/web admin:create     # asks for the admin's email, name and password
```

### Connect the domain

1. In `sukkot-web` > **Settings > Custom Domains**, add your domain and `www`.
2. In Cloudflare DNS, add the records Render shows. Keep Cloudflare's proxy on (orange cloud)
   once Render has issued the certificate.
3. Make sure `APP_URL` matches the domain exactly.

### Turn on mobile money (later)

When Orange Money or Afrimoney gives you merchant credentials:

1. Fill in their values on `sukkot-web` > **Environment**.
2. Register the callback URLs listed under "Payment providers" below.
3. Test in the provider's sandbox first, then add `ORANGE_MONEY` and/or `AFRIMONEY` to
   `PAYMENT_METHODS_ENABLED`.

### Notes

- Pushing to `main` deploys automatically. A failed migration stops the deploy, and the previous
  version keeps running.
- Check in the Render dashboard that the database plan shows backups and point-in-time recovery
  before launch.
- Per-IP rate limits read the first address in `X-Forwarded-For` (see "Reverse proxy and client
  IPs" below). Proxies such as Cloudflare and Render may append to a header the visitor already
  sent rather than replace it, so treat per-IP limits as best-effort; per-account login limits and
  lockouts do not depend on it.

## Environment

Copy `apps/web/.env.example`. In production you must set at least:

- `NODE_ENV=production`, `APP_URL=https://your-domain`
- `DATABASE_URL`
- `APP_SECRET`: at least 32 random characters (`openssl rand -hex 32`). The app refuses to start
  without it in production.
- `STORAGE_DRIVER=s3` and the `S3_*` settings (local disk is not durable on most hosts)
- `EMAIL_DRIVER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`
- `PAYMENT_METHODS_ENABLED`: for example `ORANGE_MONEY,AFRIMONEY,BANK_TRANSFER,CASH,MANUAL`.
  Do **not** include `SANDBOX`. The sandbox provider is disabled in production regardless, unless
  `ALLOW_SANDBOX_IN_PRODUCTION=true` (never set this on a live site).
- Leave `DEMO_MODE` unset (defaults to off in production). With it off, seeded demo accounts cannot
  sign in.

Secrets go in the host's secret manager, never in git.

## First deploy

```bash
pnpm install --frozen-lockfile
pnpm --filter @sukkot/web db:deploy          # apply migrations (non-destructive)
SEED_ALLOW_DEMO=false pnpm db:seed           # locations, property types, amenities, plans; no demo data in production
pnpm --filter @sukkot/web admin:create       # create the first administrator interactively
pnpm build && pnpm --filter @sukkot/web start
```

Never run `db:reset` against production; it drops all data.

## Reverse proxy and client IPs

Rate limits and audit logs use the first address in `X-Forwarded-For`. Deploy behind a proxy or load
balancer that **overwrites** this header with the real client address (Render, Fly, Cloudflare and
most managed hosts do). If the app is reachable directly, clients can spoof the header and evade
per-IP limits; per-account login limits and lockouts still apply.

## Scheduled job

Run every 15 minutes (Render cron job, GitHub Actions schedule, or system cron):

```bash
pnpm --filter @sukkot/web jobs:expire
```

## Payment providers

Callback URLs to register with each provider:

- Orange Money: `https://your-domain/api/v1/payments/webhooks/orange_money`
- Afrimoney: `https://your-domain/api/v1/payments/webhooks/afrimoney`

Orange Money uses the Orange Developer "Orange Money Web Payment" API and needs merchant onboarding
with Orange Sierra Leone. Confirm the endpoint paths, country segment and currency code against your
credentials pack. Afrimoney's adapter (`src/server/payments/providers/afrimoney.ts`) follows a generic
collect, callback, status-query pattern and **must be aligned with the API pack Africell issues**
before it is enabled. Each method stays hidden at checkout until its settings are present.

Test every provider end to end in its sandbox before going live, including a declined payment, a
duplicated callback and an amount mismatch.

## Backup and recovery

- **Database**: daily automated backups with at least 14 days retention plus point-in-time recovery.
  Take a manual snapshot before each migration. Practise a restore into a staging database each
  quarter and run the test suite and a smoke test against it.
- **Files**: enable bucket versioning and lifecycle rules for the `private/` prefix. Replicate to a
  second region if the provider supports it.
- **Restore order**: restore the database, restore or re-point storage, deploy the matching app
  version, run `db:deploy`, then check `/api/health`.
- **Secrets**: keep an offline copy of `APP_SECRET`. Changing it invalidates signed file URLs and
  changes IP hashes (sessions are unaffected).

## Production checklist

- [ ] HTTPS only; `APP_URL` uses https (cookies are `Secure` and `__Host-` prefixed in production)
- [ ] `APP_SECRET` set, 32+ characters
- [ ] `DEMO_MODE` off and no demo data seeded
- [ ] `SANDBOX` not in `PAYMENT_METHODS_ENABLED`
- [ ] First admin created with `admin:create`; strong unique password
- [ ] S3 storage configured; bucket not publicly listable
- [ ] Email domain verified; password reset tested
- [ ] Provider callbacks registered and tested
- [ ] `jobs:expire` scheduled
- [ ] Backups and point-in-time recovery enabled; a restore has been tested
- [ ] Proxy overwrites `X-Forwarded-For`
- [ ] Legal pages reviewed by a Sierra Leone lawyer (see LEGAL_REVIEW.md)
- [ ] `/api/health` monitored
