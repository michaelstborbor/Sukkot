# Sukkot Salone mobile app

Expo (SDK 57) + Expo Router + React Native. Android first, iOS supported. Uses the web app's
`/api/v1` with a bearer token stored in the device's secure storage (`expo-secure-store`).

## Run it

```bash
cp .env.example .env    # EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:3000
pnpm start              # from this folder, or `pnpm dev:mobile` from the repo root
```

The web app must be running and reachable from the phone. `localhost` only works in an emulator on
the same machine (Android emulators use `http://10.0.2.2:3000`).

## Screens

- **Explore**: keyword search, purpose chips, filters (type, district, price, currency, bedrooms,
  verified only, available only, sort), infinite scroll, pull to refresh.
- **Listing**: photo gallery, demo and illustrative labels, key facts, amenities, lister and
  verification badges, safety and legal notices, save, share, call/WhatsApp when the lister allows it,
  report listing.
- **Actions**: send enquiry, book a viewing, make an offer (sale), apply to rent (rent/lease).
- **Saved**, **Messages** (conversation list and thread, polls every 8 seconds while open).
- **Account**: profile and badges, notifications, viewings, rental applications, offers and
  payments, each with the workflow actions the API allows for that user. Listing management,
  verification uploads and settings open the website.

## Checks

```bash
pnpm typecheck                   # tsc
pnpm export:check                # bundles for Android and iOS (Hermes) without a device
```

## Building for stores

Use EAS Build (`npx eas build -p android`). Set `EXPO_PUBLIC_API_URL` to the production HTTPS URL in
the EAS build profile. Store credentials (keystores, certificates) must never be committed.

## Not yet in the app

Listing creation and editing, photo and document upload, verification submission, online checkout
and push notifications are web-only for now. See `docs/KNOWN_LIMITATIONS.md`.
