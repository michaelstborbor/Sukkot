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
- Property types are added through a migration, not from the admin area.
  Amenities, locations, plans and site settings are editable in the admin area.
- Mobile app: listing creation and editing, photo and document upload, verification submission, online
  checkout, lease-terms proposals and payee confirmation of recorded payments are done on the website.
  The app links to the relevant web pages.
- Rent schedules are generated when a tenancy starts; there are no automatic reminders yet.
- Plans are bought from the website's Plans and billing page; the mobile app does not sell plans.
- Pay by transfer relies on finance staff checking the business statement by hand. There is no
  automatic statement import yet.
- Plan prices are starting guesses, not market research. Set real prices in Admin → Plans. The
  inspection visit (Le 350) and extra listing slot (Le 100) prices are starting guesses too; change
  them in Admin → Site settings.
- Search alerts go out in the app and by email (when email is switched on), not by SMS or WhatsApp.
  They are sent when a moderator first approves a listing; a listing that is paused and resumed does
  not alert again.
- Refunds are paid back by hand (outside the platform) and then recorded by finance staff under
  Admin → Payments.
- Inspection visits are arranged by staff by phone; there is no calendar of staff availability.
- Area rent ranges come only from live, non-demo listings in Leones, and are hidden until at least
  three listings of a kind back them.
- The phone app is not yet in the Google Play or App Store. Set `NEXT_PUBLIC_ANDROID_APP_URL` and
  `NEXT_PUBLIC_IOS_APP_URL` once it is, and the Get the app page shows the store links.
- The built-in list of cities, towns and areas is a hand-curated starter list, not OpenStreetMap
  data, and it is incomplete. The OpenStreetMap import (see Deployment → Locations from
  OpenStreetMap) has been tested only against a small sample file; it has not yet been run
  against the live Overpass service. Areas that OpenStreetMap places far from any city or town
  are reported and skipped, and villages are left out unless asked for.
- Listing videos (one per listing, up to 60 seconds and 100 MB) are converted on the web server
  itself with ffmpeg, one at a time. On a small server such as Render's free plan a one-minute
  clip can take several minutes. If the server restarts mid-conversion the lister is told to upload
  again. The mobile app does not play listing videos yet; they show on the website.
- "Other (specify)" listings are searchable under the Other category, not by the lister's own words
  in the type filter.

## Operations

- Per-IP rate limits trust `X-Forwarded-For`; see DEPLOYMENT.md.
- Rate limiting is stored in Postgres, which is fine at MVP scale but should move to Redis under load.
- Messaging uses polling (every 8 seconds while a thread is open) rather than websockets.
- The mobile app has been type-checked, bundled for Android and iOS, and exercised in a browser build
  against the API. It has **not** yet been run on a physical Android or iOS device.
