# Deployment

## Components

| Component | Suggested host | Notes |
|---|---|---|
| Web + API | Render, Railway, Fly.io or any Node 20+ host; Vercel also works | One Next.js process (`pnpm build` then `pnpm --filter @sukkot/web start`) |
| PostgreSQL 16 | Neon, Render, Supabase, RDS | Enable automated daily backups and point-in-time recovery |
| File storage | Cloudflare R2, AWS S3, Backblaze B2 | Two prefixes: `public/` (resized images) and `private/` (documents). The bucket itself must not be public; expose only `public/` through a CDN if you set `STORAGE_PUBLIC_BASE_URL` |
| Email | Resend (`EMAIL_DRIVER=resend`) | Verify your sending domain |
| Mobile | EAS Build → Google Play / App Store | Set `EXPO_PUBLIC_API_URL` to the production HTTPS URL |

## Free testing setup: Render free plan + Neon

Use this to try the platform at no cost. It is a test site, not a live one: it runs in demo mode,
uploaded files do not survive a restart, and emails are written to the logs instead of being sent.
The Blueprint is `render.free.yaml`.

| Piece | Free option | Limit to know about |
|---|---|---|
| Web + API | Render free web service | Sleeps after about 15 idle minutes; the next visit takes about a minute |
| Database | Neon free Postgres | 0.5 GB; does not expire (Render's free database is deleted after 30 days) |
| Files | The service's own disk | Wiped on every restart and deploy |
| Email | Console driver | Verification and reset links appear in Render's Logs tab |
| Expiry job | Not scheduled | Expired holds and offers are not cleaned up automatically |

### Steps

1. **Neon**: sign up at neon.tech and create a project (region: Frankfurt, Postgres 16). On the
   dashboard, click **Connect**, turn **Connection pooling** off and copy the connection string. It
   looks like `postgresql://user:password@ep-....eu-central-1.aws.neon.tech/neondb?sslmode=require`.
   Keep it private.
2. **Render**: sign up at render.com with GitHub and allow access to this repository.
3. **New > Blueprint**, pick this repository and set **Blueprint Path** to `render.free.yaml`.
4. Render asks for two values:
   - `DATABASE_URL`: the Neon string from step 1.
   - `APP_URL`: enter `https://sukkot-web-test.onrender.com` for now. If Render gives the service a
     different URL, update this value under the service's **Environment** tab and save.
5. Click **Apply**. The first build takes several minutes. Migrations run when the service starts.
6. **Load reference data and demo accounts** from your own computer (the free plan has no Shell).
   With Node 22 and pnpm installed, in a checkout of this repository:

   ```bash
   pnpm install
   export DATABASE_URL='<the Neon string from step 1>'
   pnpm --filter @sukkot/web db:deploy
   export SEED_DEMO_PASSWORD="$(openssl rand -base64 18)"
   echo "$SEED_DEMO_PASSWORD"               # note it down; it is the password for every demo account
   SEED_ALLOW_DEMO=true pnpm db:seed
   pnpm --filter @sukkot/web admin:create   # your own administrator account
   ```

   The seed adds locations, property types and amenities, plus labelled demo listings and demo
   accounts such as `admin@demo.sukkot.sl`, `landlord@demo.sukkot.sl` and `tenant@demo.sukkot.sl`.
   The test site is on the public internet and one demo account is a super administrator, so always
   set `SEED_DEMO_PASSWORD` as above. Never use the built-in local development password here. Never
   run `db:reset` against this database unless you mean to erase it.
7. Open the service URL and sign in. To try the mobile app against it, set
   `EXPO_PUBLIC_API_URL` to the same URL in `apps/mobile/.env`.

### First admin without a terminal

On every start the service runs `bootstrap`, which loads the reference data into an empty database
and, while there is no super administrator yet, creates one from two environment variables:

1. In Render, open the web service, then **Environment**. Add `ADMIN_EMAIL` (your email) and
   `ADMIN_PASSWORD` (at least 10 characters, letters and numbers), optionally `ADMIN_NAME`, and save.
   Render restarts the service.
2. In **Logs**, look for `[bootstrap] Super administrator ready`. Sign in with that email and password,
   then open `/admin`.
3. Delete `ADMIN_PASSWORD` from **Environment**. Once an administrator exists the variables are
   ignored, but the password should not stay in the settings.

If the start command shown under **Settings** does not include `bootstrap`, set it to the
`startCommand` in `render.free.yaml`. Demo accounts do not count as an administrator here.

Uploaded photos, videos and documents are kept in the database (`STORAGE_DRIVER=database`), because
the free plan wipes the service's own disk on every restart and deploy. Files uploaded while the
setting was `local` are gone and have to be uploaded again; listings show a placeholder until then,
and the lister's dashboard marks each missing photo. Check that **Environment** shows
`STORAGE_DRIVER=database`: a value set there earlier is not always replaced by the Blueprint.
Neon's free database holds about 0.5 GB, so before it fills up add the R2 settings from `render.yaml`
and change `STORAGE_DRIVER` to `s3`. For real email, add the Resend settings and change
`EMAIL_DRIVER` to `resend`.

### Email verification

Sign-up emails a confirmation link. Until people open it they can browse, save, enquire and message,
but they cannot submit a listing for review, ask for a photo shoot, make an offer, apply to rent or
pay Sukkot Salone. That rule is on whenever `EMAIL_DRIVER=resend`, because only then can people
receive the link. With `EMAIL_DRIVER=console` it is off, and on a demo site the dashboard's "Send the
link again" button shows the link on screen instead. Set `REQUIRE_EMAIL_VERIFICATION=true` or `false`
to override this either way.

### Before real users arrive

Do not turn the test site into the live one by editing it. Create the live site from `render.yaml`
(next section) instead. If you do reuse anything, first remove `DEMO_MODE` and
`ALLOW_SANDBOX_IN_PRODUCTION`, remove `SANDBOX` from `PAYMENT_METHODS_ENABLED`, and delete the demo
data.

While `DEMO_MODE` is `true`, the first start adds the labelled demo listings (about two dozen, across
houses, flats, rooms, land, shops, offices, hotels and short stays). They belong to demo accounts that
cannot sign in, and nothing on them is marked verified or reviewed. They are added only once: a demo
listing a super administrator deletes under **Admin → Listing moderation → Delete permanently** stays
deleted.

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

When Orange Money or Afrimoney gives you merchant credentials, a super administrator can set them up
without touching the server:

1. Open **Admin → Site settings** and fill in the Orange Money or Afrimoney checkout section. Keys are
   stored encrypted with `APP_SECRET` and are never shown again; leave a key field empty to keep the
   saved one. If `APP_SECRET` changes, enter the keys again.
2. Register the callback URL shown in that section with the provider.
3. Test in the provider's sandbox first (put the sandbox address in **API address**), then tick
   **Offer … at checkout**. A method cannot be switched on until all its details are filled in.

Alternatively, set the `ORANGE_MONEY_*` or `AFRIMONEY_*` values on `sukkot-web` > **Environment** and add
`ORANGE_MONEY` and/or `AFRIMONEY` to `PAYMENT_METHODS_ENABLED`. Values set there take precedence over
Site settings.

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

### AI chat assistant

The chat button answers with fixed replies until `ANTHROPIC_API_KEY` is set. With a key (create one
at console.anthropic.com, under a workspace with a monthly spend limit), it holds real conversations
and searches published listings. It can read listings and help content only: it cannot sign anyone
in, change data, take payments or message listers. Each visitor is limited to 15 questions per
10 minutes and 80 per day. `ASSISTANT_MODEL` picks the model (default `claude-opus-5-5`). A question typically
costs a few US cents with the default model; set a spend limit in the Anthropic console to cap the bill.

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

## Locations from OpenStreetMap

The seed loads a starter list of Sierra Leone's 16 districts with their cities, towns and areas
(sections). To fill in more places from OpenStreetMap, run the import from any machine that can
reach `overpass-api.de` and the database:

```bash
pnpm --filter @sukkot/web locations:import-osm               # report what would change
pnpm --filter @sukkot/web locations:import-osm -- --apply    # write it
```

- It only adds places and links existing ones (matched by OpenStreetMap id, then by name inside the
  same parent). It never deletes, hides or renames a location. Hide anything unwanted in
  Admin → Locations.
- Cities and towns become the second level of the filter; suburbs, quarters and neighbourhoods
  become areas under the nearest city (within 15 km) or town (within 5 km).
- If Sierra Leone's districts are tagged at a different level, pass `--district-level 6`. Villages
  are skipped unless you pass `--include-villages`.
- No access to Overpass from the server? Run the same query elsewhere, save the JSON and pass
  `--file export.json` (`--save` keeps a copy of a live download).
- OpenStreetMap data is © OpenStreetMap contributors under the ODbL. Once any place is imported, the
  search filters show that attribution automatically; keep it.

## Getting paid for plans and featured listings

Landlords and agents pay Sukkot Salone for Pro plans and featured listings. Rent and sale money never
passes through the platform.

**Before the mobile money APIs are live**, take payment by transfer:

1. In **Admin → Site settings → Pay by transfer**, enter the account name customers see and at least one
   of: an Orange Money or Afrimoney business number, or bank details. Tick **Offer pay by transfer at
   checkout** and save. Use business accounts only.
2. At checkout, customers see those details and the exact amount, send the money, and enter the
   transaction ID from their confirmation SMS or receipt.
3. Finance staff (Finance or Super admin role) are notified. In **Admin → Payments → Transfers to
   check**, find the same amount and transaction ID on the business statement, then click
   **Confirm received** (the plan or promotion starts and the customer is notified) or **Not found**
   with a reason.

A transaction ID can only be used once. Confirmed transfers are marked *Recorded* and never
*Provider verified*. Nobody can confirm their own payment.

**Prices** are set in **Admin → Plans** (plans) and **Admin → Site settings** (featured listing, 7
days). The seed starts at Landlord Pro SLE 300 and Agent Pro SLE 900 per 30 days and a featured listing
at SLE 100. These are starting guesses; change them as you learn what customers accept.

**What a plan gives**: the listing limit applies when a listing is submitted for review or resumed
(listings already live are never taken down when a plan ends). Featured slots are used from
**Plans and billing** on a listing's "Feature for 7 days" link. Renewing before a plan ends queues the
new period to start when the current one ends. The scheduled job marks ended plans as expired and
sends a reminder three days before the end; without the job, limits still follow the paid dates, but
no reminders go out.

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
