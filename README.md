# web-page

Customer Portal Demo
====================

Overview
--------
This project is a static single-page shipping booking demo. It runs directly from HTML, CSS, and browser-side JavaScript and now includes local fallback behavior so the main flow still works without a backend API.

Current behavior
----------------
- Schedule search first tries `/api/schedules` and falls back to local mock data.
- Quote generation first tries `/api/quotes` and falls back to local browser-side quote calculation.
- API failures are surfaced with user-friendly error messages.
- Mock schedule data includes capital-city coverage and synthetic schedule generation for unmatched demo searches.

Quick start
-----------
1. Open a terminal in the project:

   cd web-page

2. Start the local gateway and static server:

   npm install
   npm run dev

3. Open the app:

   http://localhost:4000

Notes
-----
- `npm run dev` starts `server.js`, serves the static app, and proxies `/api/quotes` and `/api/equipment`.
- The static app still has local fallbacks for schedules and quote generation when backend APIs are unavailable.
- Booking submission still expects an API unless additional offline booking fallback logic is added.

Local dev tokens
----------------
The gateway can mint HS256 JWTs for local backend smoke testing. Both endpoints accept optional `subject`, `scopes`, and `expiresInMinutes` JSON fields.

- `POST /api/auth/token` returns an Equipments-audience token with default audience `equipments-service` and scopes `equipments:read equipments:modify`.
- `POST /api/auth/quotes-token` returns a Quotes-audience token with default audience `quotes-service` and scopes `quotes:admin quotes:approve`.

Example:

```bash
curl -s http://localhost:4000/api/auth/quotes-token \
  -H 'Content-Type: application/json' \
  -d '{"subject":"local-quotes-admin"}'
```

Use `AUTH_JWT_SECRET`, `AUTH_JWT_ISSUER`, `AUTH_JWT_AUDIENCE`, and `AUTH_QUOTES_JWT_AUDIENCE` to override local JWT values. This is only a local developer helper, not production identity-provider behavior.

Mock data
---------
- Mock schedules live in `mock/db.json`.
- The mock database includes 247 capital-city schedule entries.
- If a direct route is not found in the mock file, the app generates synthetic demo schedules so searches still return usable results.

Search examples
---------------
- `Singapore` to `Los Angeles`
- `Budapest` to `London`
- `SGSIN` to `USLAX`
- `NYC` to `LON`

Files of interest
-----------------
- `index.html` — static app shell
- `css/styles.css` — page styling
- `js/app.js` — UI flow and user-facing error handling
- `js/api.js` — API calls, mock fallbacks, synthetic schedules, and quote logic
- `mock/db.json` — local schedule dataset

Troubleshooting
---------------
- If you do not see the latest behavior, hard refresh the page.
- If schedule search shows no exact route, the app should still generate demo schedules.
- If quote creation cannot reach `/api/quotes`, the app should compute a local demo quote automatically.
