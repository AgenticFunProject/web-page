# web-page

Customer Portal Demo
====================

Overview
--------
This project is a static single-page shipping booking demo. It runs directly from HTML, CSS, and browser-side JavaScript and now includes local fallback behavior so the main flow still works without a backend API.

Current behavior
----------------
- Schedule search first tries `/api/schedules` and falls back to local mock data.
- Quote generation uses the frontend quote-source switch so you can explicitly choose the Azure service or the mocked demo flow.
- API failures are surfaced with user-friendly error messages.
- Mock schedule data includes capital-city coverage and synthetic schedule generation for unmatched demo searches.

Quick start
-----------
1. Open a terminal in the project:

   cd mayor

2. Start a local static server:

   python3 -m http.server 8080 --directory .

3. Open the app:

   http://localhost:8080

Notes
-----
- This repo currently does not include a working `package.json`, so `npm run dev` and `npm run dev:all` are not the correct startup path here.
- Quotes now default to the Azure service at `https://app-quotes-dev-b8d336.azurewebsites.net` (override with `QUOTES_URL` if needed).
- The selected quote source is persisted in the browser so the UI keeps your last Azure/mock choice.
- The static server is enough for the demo flow because schedules and quotes have local fallbacks.
- Booking submission still expects an API unless additional offline booking fallback logic is added.

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
- If Azure mode is selected and the quotes service fails, the app now shows the service error so you can switch to mocked mode explicitly.
