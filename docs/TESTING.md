# Testing

## Suites

| Suite | Command | Needs |
|---|---|---|
| Shared unit tests (money, phone, search params, permissions, state machines) | `pnpm --filter @sukkot/shared test` | nothing |
| Web unit + integration (services and route handlers against a real Postgres) | `pnpm --filter @sukkot/web test` | Postgres. Uses `TEST_DATABASE_URL`, default `postgresql://postgres@localhost:5432/sukkot_test`. The setup refuses any database whose URL does not contain `test`, applies migrations and seeds reference data if empty |
| End-to-end (Playwright, desktop + Pixel 7 viewports) | `pnpm --filter @sukkot/web build && pnpm --filter @sukkot/web test:e2e` | A migrated and seeded database in `DATABASE_URL`, `DEMO_MODE=true`. Set `PLAYWRIGHT_CHROMIUM_PATH` to use a preinstalled Chromium |
| Mobile typecheck and bundle | `pnpm --filter @sukkot/mobile typecheck` and `pnpm --filter @sukkot/mobile export:check` | nothing |

Integration tests cover: registration, login, lockout and sessions; listing creation, image upload,
moderation and search visibility; enquiries and messaging permissions; the offer workflow including
due diligence and availability changes; payments (server pricing, signed webhooks, duplicate events,
amount mismatch, recorded payments never verified); private document access; CSRF and bearer
handling; mobile sign-in without an Origin header; health check.

CI (`.github/workflows/ci.yml`) runs all of the above on every pull request.

## Latest recorded run

Run on 2026-10-14 in the development container (Node 22, Postgres 16, Chromium):

| Check | Result |
|---|---|
| `pnpm typecheck` (shared, web, mobile) | passed |
| `pnpm lint` (web) | no warnings or errors |
| `packages/shared` tests | 19 passed |
| `apps/web` unit + integration tests | 23 passed (8 files) |
| `pnpm build` (web, production) | succeeded |
| Playwright e2e | 12 passed (6 tests × desktop and mobile viewports) |
| Mobile `expo export` for Android and iOS | succeeded (Hermes bundles) |
| Mobile manual smoke test (web build of the app against the local API, Pixel 7 viewport) | explore, purpose filter, filters sheet, listing detail, sign-up, enquiry, conversation and sending a message worked with no console errors |

Not yet done: running the mobile app on a physical Android or iOS device, and testing the Orange Money
and Afrimoney adapters against the providers' sandboxes (no merchant credentials yet).

GitHub Actions: the first run caught that the end-to-end job seeded the database before the Prisma
client was generated (fixed by generating it on install). The next run passed both jobs: typecheck,
lint, tests, build and mobile bundling, and the Playwright suite.
