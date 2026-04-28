# web-page

Customer Portal — Demo
======================

Overview
--------
This is a small single-page React app (Vite + React + Tailwind) plus a lightweight Express mock API so the UI is demo-ready locally.

Prerequisites
-------------
- Node.js (16+ recommended) and npm
- Network access to npm registry (or configure npm for your proxy)

Quick start (recommended)
-------------------------
1. Open a terminal and enter the project:

   cd customer-portal

2. Install dependencies:

   npm install

   If the mock server fails to run because express/cors/concurrently are missing, run:

   npm install express cors concurrently

3. Start both mock API and dev server:

   npm run dev:all

   - Mock API: http://localhost:4000/api
   - Vite dev server: usually http://localhost:5173

Alternative (separate)
----------------------
- Start mock API only:
  npm run mock
- Start dev server only:
  npm run dev

Environment
-----------
- Frontend reads VITE_API_BASE (e.g., VITE_API_BASE=http://localhost:4000/api). Default is http://localhost:4000/api.

Build
-----
- npm run build
- npm run preview (serve production build locally)

Notes & Troubleshooting
-----------------------
- If npm install hangs (corporate proxy / certificate issues), configure npm proxy/CA or run install on a machine with open internet access.
- The mock server is intentionally simple — business logic belongs in real backend services.

Files of interest
-----------------
- src/ — React app and components
- mock-server/index.js — mock API (schedules, quotes, bookings)
- package.json — scripts (dev, mock, dev:all)

Enjoy the demo. Report issues and next feature requests here.
