# Architecture

## Layout

```
apps/web         Next.js 15 App Router: pages, route handlers (/api/v1), server services, Prisma schema
apps/mobile      Expo Router app that consumes /api/v1
packages/shared  Enums, Zod schemas, state machines, money/phone/date helpers, API DTO types, legal notices
```

pnpm workspaces with `node-linker=hoisted` (Expo/Metro expects a flat `node_modules`). React is pinned
to the same version in both apps so only one copy is installed.

## Web app layers

| Layer | Location | Rule |
|---|---|---|
| Pages | `src/app/(site)` public, `src/app/(app)/dashboard` signed-in, `src/app/(app)/admin` staff | Server components call services directly; client components call the API |
| API | `src/app/api/v1/**/route.ts` | Thin: every handler is wrapped in `handler()` (`src/server/http.ts`) and delegates to a service |
| Services | `src/server/services/*`, `src/server/payments/*` | All business rules, permission checks, transactions, audit logging and notifications |
| Data | `prisma/schema.prisma` (48 models), `src/server/db.ts` | Postgres; money is `BigInt` minor units; timestamps are UTC, shown in Africa/Freetown (GMT) |
| Storage | `src/server/storage` | Driver interface: local disk (dev) or S3-compatible. Public images are resized WebP; private documents are served only through permission-checked, HMAC-signed URLs |

### `handler()` (src/server/http.ts)

Resolves the actor (cookie session for web, `Authorization: Bearer` for mobile), enforces the CSRF
origin check on cookie-authenticated mutations, exposes `ctx.body(schema)`, `ctx.query(schema)`,
`ctx.requireActor()` and `ctx.limit(bucket, limits, scope?)` (database-backed rate limiting), and maps
`AppError`/Zod errors to `{ error: { code, message, fields } }` with the right HTTP status.

Requests with `X-Client: mobile` never use cookies. They authenticate only with a bearer token, so the
origin check does not apply to them (native apps send no Origin header).

### Permissions

Roles (`USER`, `OWNER`, `AGENT`, `SUPER_ADMIN`, `MODERATOR`, `VERIFICATION_OFFICER`, `SUPPORT`,
`FINANCE`) map to permissions in `packages/shared/src/permissions.ts`. Services check permissions
and ownership; pages use `requirePagePermission` / `requirePageActor`.

### Workflows

State machines in `packages/shared/src/workflows.ts` drive listings, inspections, rental
applications and offers. The API returns `actions` per record (what the current user may do next), so
both clients render buttons from the same rules. Each transition is written to a history/event table.

### Payments

`src/server/payments/index.ts` with provider adapters (`sandbox`, `orange-money`, `afrimoney`).

- Online collection only for platform purposes (subscriptions, listing promotion). Amounts are priced
  on the server, never taken from the client.
- A payment becomes `SUCCEEDED` only from a signed, de-duplicated webhook or a provider status query.
  Amount or currency mismatches mark it `DISPUTED`.
- Rent and sale money is never collected. It can be **recorded** by the payee (`RECORDED`) or by the
  payer (`PENDING` until the payee confirms). Recorded payments are labelled as not provider-verified.

### Background jobs

`scripts/expire-records.ts` (`pnpm --filter @sukkot/web jobs:expire`) expires offers past their
deadline, ends promotions, expires verification badges and deletes old sessions, tokens and
rate-limit buckets. It never touches pending payments. Run it on a schedule (see DEPLOYMENT.md).

## Mobile app

- `src/lib/api.ts`: fetch wrapper adding `X-Client: mobile` and the bearer token; token kept in
  `expo-secure-store`. A 401 clears the session.
- `src/lib/auth.tsx`: auth context (`/auth/login`, `/auth/register`, `/me`, `/auth/logout`).
- `src/app`: Expo Router screens: tabs (Explore, Saved, Messages, Account), modal forms (filters,
  enquiry, viewing, offer, application, report, sign in/up), conversation and activity lists.
- Search filters use the same `parseSearchParams` / `serializeSearchParams` as the website, so the
  query string means the same thing on both.
