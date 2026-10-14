# Known limitations

Honest list of what is incomplete or needs work before production.

## Integrations

- **Afrimoney**: the adapter uses a generic collect/callback/status pattern and has not been tested
  against Africell's real API. It must be aligned with the merchant API pack and tested in their
  sandbox. It stays disabled until configured.
- **Orange Money**: implemented against Orange's published Web Payment API, but not yet run against a
  real merchant account. Endpoint paths and currency codes must be confirmed during onboarding.
- **Card payments**: not implemented. The method exists as a placeholder and is never offered.
- **SMS and WhatsApp notifications**: not implemented; notifications are in-app and email only.
- **Push notifications** in the mobile app: not implemented.

## Product

- No map view yet (listing coordinates are stored; approximate locations are supported in the data).
- No admin editor for content pages; Terms, Privacy and other legal pages are static drafts in code.
- Property types are added through the database seed or a migration, not from the admin area.
  Amenities, locations, plans and site settings are editable in the admin area.
- Mobile app: listing creation and editing, photo and document upload, verification submission, online
  checkout, lease-terms proposals and payee confirmation of recorded payments are done on the website.
  The app links to the relevant web pages.
- Rent schedules are generated when a tenancy starts; there are no automatic reminders yet.

## Operations

- Per-IP rate limits trust `X-Forwarded-For`; see DEPLOYMENT.md.
- Rate limiting is stored in Postgres, which is fine at MVP scale but should move to Redis under load.
- Messaging uses polling (every 8 seconds while a thread is open) rather than websockets.
- The mobile app has been type-checked, bundled for Android and iOS, and exercised in a browser build
  against the API. It has **not** yet been run on a physical Android or iOS device.
