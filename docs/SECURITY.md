# Security

Report vulnerabilities privately to the maintainers. Do not open public issues for them.

## Model

- **Passwords**: bcrypt; minimum 10 characters with letters and numbers. Accounts lock for a few
  minutes after 8 failed attempts. Login is rate-limited per account and per IP.
- **Sessions**: random opaque tokens; only a SHA-256 hash is stored. Web uses an HttpOnly, SameSite=Lax
  cookie (`__Host-` prefixed and `Secure` in production). The mobile app uses a bearer token kept in
  the device keychain/keystore. Sessions are revocable and are removed on password reset.
- **CSRF**: cookie-authenticated mutations must come from the app's own origin. Bearer and
  `X-Client: mobile` requests never use cookies.
- **Authorisation**: role-based permissions plus ownership checks inside every service. Staff access
  to private conversations is audited.
- **Validation**: every API input is parsed with the shared Zod schemas; amounts are parsed to integer
  minor units; uploads are type- and size-checked, images are re-encoded (removing EXIF/location).
- **Files**: private documents are never in a public path; they are served after a permission check
  through short-lived HMAC-signed URLs.
- **Payments**: no card data is stored or handled. Webhooks are signature-verified, de-duplicated by
  event id, and success is re-confirmed with the provider. The platform never marks rent or sale money
  as provider-verified, never holds client funds and offers no escrow.
- **Audit log**: moderation, verification decisions, role changes, suspensions, payment status
  changes and staff views of private data are recorded.
- **Demo data**: demo accounts share a published password, so they are refused at sign-in unless
  `DEMO_MODE=true` (off by default in production). The sandbox payment provider is disabled in
  production.
- **Secrets**: only in environment variables. `.env` files are git-ignored.

## Checklist before launch

See the production checklist in [DEPLOYMENT.md](DEPLOYMENT.md). Also:

- Run a dependency audit (`pnpm audit`) and update anything critical.
- Have someone outside the team test authentication, file access and payments.
- Configure security headers at the proxy if your host does not add them (the app sets a baseline in
  `next.config`).
