# Development log

## 2026-10-14: MVP

Built from the master specification, using the Lovable prototype at sukkotsalone.lovable.app as a
visual reference only (its code could not be exported).

**Foundation**: pnpm monorepo; shared package with enums, Zod schemas, state machines, money (BigInt
minor units) and Sierra Leone phone helpers; Prisma schema (48 models) and initial migration; seed with
Sierra Leone provinces, districts, cities and localities, property types, amenities, plans and clearly
labelled demo data.

**Web and API**: session auth (cookie and bearer), CSRF origin checks, database rate limiting and
account lockout; public marketplace (home, search with persistent URL filters, listing pages, agents,
locations, compare, help, safety, verification, legal drafts, sitemap, robots); owner/agent dashboard
(listing form for houses, apartments, land, commercial and short stays; photos and private documents;
moderation states; enquiries; messaging; viewings; rental applications through to tenancy and rent
schedule; offers with counteroffers and due diligence; payments; billing and promotion; verification
requests; agency management; settings); admin area (overview, moderation, verification, reports,
users and roles, agencies, locations, amenities, plans, payments, settings, audit log). Payments with
sandbox, Orange Money and Afrimoney providers; online collection only for platform fees; rent and sale
money recorded only. Maintenance scripts for creating the first admin and expiring records.

**Mobile**: Expo SDK 57 app with explore and filters, listing detail, saved, messages, enquiries,
viewings, offers, rental applications, payments, notifications and account.

**Fixes found while testing**: login rate limit was shared across all anonymous users (now per
account plus a per-IP ceiling); mobile sign-in was rejected by the CSRF check because native apps send
no Origin header (mobile requests are now token-only and exempt); seeded demo accounts could have
signed in on a production site if seeded there (now refused unless demo mode is on); admin "feature
listing" went through the moderation state machine (now a dedicated audited action).

**Verification**: see TESTING.md for the recorded results.
