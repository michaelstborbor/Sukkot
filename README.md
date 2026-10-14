# Sukkot Salone

Real estate marketplace and property management platform for Sierra Leone: houses, apartments,
land, commercial space and short stays, for rent, lease and sale. One codebase gives you:

- **Web app and JSON API** (`apps/web`, Next.js 15 + PostgreSQL/Prisma): public marketplace, owner and
  agent dashboards, enquiries and messaging, viewings, rental applications, offers with due diligence,
  tenancy and rent records, verification, payments (Orange Money, Afrimoney, recorded payments),
  and an admin area for moderation, verification, reports, users, catalogue, plans and audit.
- **Mobile app** (`apps/mobile`, Expo + React Native): explore and filter listings, listing details,
  saved properties, enquiries and messaging, viewings, offers, rental applications, payments and
  notifications. It talks to the same `/api/v1`.
- **Shared package** (`packages/shared`): enums, Zod validation schemas, state machines, money and
  phone helpers, API types and legal notices used by the API and both clients.

> **Status:** MVP. See [docs/DEVLOG.md](docs/DEVLOG.md) for what is built and verified and
> [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) before launching anything.

## Quick start (local)

Requirements: Node 20.11+, pnpm 10, PostgreSQL 16 (or Docker).

```bash
pnpm install
docker compose up -d                       # local Postgres (or point DATABASE_URL at your own)
cp apps/web/.env.example apps/web/.env     # then edit values
pnpm db:migrate                            # create the schema
pnpm db:seed                               # locations, catalogue and clearly-labelled demo data
pnpm dev                                   # http://localhost:3000
```

Create a real administrator (prompts for the password; nothing is hardcoded):

```bash
pnpm --filter @sukkot/web admin:create
```

Seeded demo accounts exist only for local development. Their password is printed by the seed and
they cannot sign in unless `DEMO_MODE=true`, which is off by default in production.

### Mobile app

```bash
cp apps/mobile/.env.example apps/mobile/.env   # set EXPO_PUBLIC_API_URL to your computer's LAN address
pnpm dev:mobile                                 # opens Expo; scan the QR code with Expo Go or a dev build
```

See [apps/mobile/README.md](apps/mobile/README.md).

## Common commands

| Command | What it does |
|---|---|
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm lint` | ESLint (web) |
| `pnpm test` | Unit and integration tests (needs a Postgres database whose name contains `test`) |
| `pnpm --filter @sukkot/web test:e2e` | Playwright end-to-end tests, desktop and mobile viewports |
| `pnpm build` | Production build of the web app |
| `pnpm --filter @sukkot/web jobs:expire` | Expire offers, promotions and verification badges; clean old sessions. Run on a schedule |

## Documentation

- [docs/PLAN.md](docs/PLAN.md): stack, scope, data model, routes, design system, roadmap
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the code is organised and why
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): production setup, providers, scheduled jobs, backup and recovery
- [docs/SECURITY.md](docs/SECURITY.md): security model and checklist
- [docs/TESTING.md](docs/TESTING.md): how to run tests and the latest recorded results
- [docs/LEGAL_REVIEW.md](docs/LEGAL_REVIEW.md): items a Sierra Leone lawyer must review before launch
- [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md): what is not done yet
- [docs/DEVLOG.md](docs/DEVLOG.md): development log

## Important product rules

- Offers accepted on the platform are agreements in principle only. They never transfer ownership.
- Sukkot Salone does not hold client money or provide escrow. Rent and sale money is paid between the
  parties and can only be **recorded**; it is never shown as provider-verified.
- Online payments (subscriptions, listing promotion) are marked paid only after a signed provider
  callback or a provider status check.
- Verification badges say which checks were done; they do not certify legal title.
- Demo listings, accounts and illustrative images are labelled everywhere they appear.
