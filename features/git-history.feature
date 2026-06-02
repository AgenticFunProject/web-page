Feature: Gateway Development History
  As a developer reviewing the commit log
  I want each change described as a Gherkin scenario
  So that the intent and outcome of every commit is clear

  Background:
    Given the web-page gateway repository at github.com/AgenticFunProject/web-page
    And the gateway deployed at https://gateway.thankfulpond-5ed1bd9d.westeurope.azurecontainerapps.io
    And the infrastructure in resource group rg-web-page-gateway on subscription 37ef9374-dd0c-4633-aefc-0ea6c2dae0b3

  # --- Session 1: Initial Setup ---

  Scenario: Add quotes dev token endpoint
    Given no authentication was implemented
    When commit 81db122 was created
    Then a dev token endpoint was added for testing quotes API

  Scenario: Configure production AUTH_JWT_SECRET and HTTPS proxy
    Given the gateway was running locally with dev secrets
    When commit 27189a0 was created
    Then AUTH_JWT_SECRET was configured from Key Vault
    And HTTPS proxy support was added
    And the default secret was set to equipments-prod-dev-secret-change-me-2026

  Scenario: Add Dockerfile for Azure Container Apps deployment
    Given no container image existed
    When commit ea046d5 was created
    Then a Dockerfile was added
    And the image was built via az acr build and deployed to Azure

  Scenario: Add login endpoint and users service proxy
    Given the gateway had quotes and equipments routes only
    When commit 47f604b was created
    Then POST /api/auth/login was added
    And /api/users proxy route was added
    And the gateway proxied to users-service.nicefield-3b22b31f.northeurope.azurecontainerapps.io

  Scenario: Fix login for users service array response
    Given the users service returned an array instead of a single user
    When commit 6a8d3be was created
    Then the login handler was fixed to extract the first element
    And USERS_URL was added to the Dockerfile env

  Scenario: Add login form to frontend
    Given the frontend showed search immediately
    When commit 901434d was created
    Then a sign-in section was added as the first screen
    And a logout button was added to the header
    And UsersAPI.login() was added to api.js

  Scenario: Add booking service integration
    Given the booking service spec defined POST /api/v1/bookings
    When commit d20b4f3 was created
    Then /api/bookings proxy route was added to the gateway
    And BookingAPI.submit() was added to api.js
    And the booking form data was mapped to the booking service contract

  Scenario: Enforce valid email format with TLD on login and booking forms
    Given email inputs accepted any string
    When commit ef28b6c was created
    Then pattern="[^@]+@[^@]+\.[^@]{2,}" was added requiring a TLD

  # --- Session 2: Session & Form Persistence ---

  Scenario: Pre-fill booking email from logged-in user profile
    Given the booking email field was always empty
    When commit 9dabf56 was created
    Then state.user.email was written into the contact-email field on showSection('booking')

  Scenario: Cache login session in localStorage; restore on page load
    Given the user had to log in again after every refresh
    When commit 566960c was created
    Then the session (token + user) was saved to localStorage on login
    And restoreSession() checked localStorage on page load
    And handleLogout() cleared the saved session

  Scenario: Cache login email and booking form fields in localStorage
    Given fields were always blank on page load
    When commit fa8272d was created
    Then loginEmail was cached in localStorage
    And bookingFormData (contactName, contactEmail, contactPhone) was cached from submissions
    And showSection('booking') restored the cached values

  Scenario: Replace pre-fill with click-to-suggest datalist
    Given fields were auto-filled with cached values
    When commit 1221544 was created
    Then pre-fill was removed
    And <datalist> elements were added to login email and booking fields
    And populateDatalist() filled suggestions on click

  Scenario: Add autocomplete=off and migrate old localStorage keys
    Given old loginEmail and bookingFormData keys existed in localStorage
    When commit 61cc058 was created
    Then autocomplete="off" was added to all managed fields
    And migrateOldSuggestions() converted old keys to suggest:* format

  Scenario: Block browser autofill with readonly-on-focus trick
    Given the browser still auto-filled credentials despite autocomplete="off"
    When commit ca6c807 was created
    Then readonly was added to email fields
    And onfocus="this.removeAttribute('readonly')" was set
    So the browser cannot pre-fill readonly fields

  # --- Session 3: UI Fixes ---

  Scenario: Add generic .hidden CSS rule
    Given .hidden was only defined for section.hidden, .results.hidden, .error.hidden
    When commit b9dbe51 was created
    Then .hidden { display: none !important; } was added as a generic rule
    So user-info.hidden and any other element with .hidden is properly hidden

  Scenario: Clear display name text on logout
    Given the user's name remained as textContent even after logout
    When commit 7a1ccac was created
    Then document.getElementById('user-display-name').textContent = '' was added to handleLogout

  # --- Session 4: Real Data ---

  Scenario: Replace mock Capital Carrier names with real vessel names
    Given 247 schedules had vesselName "Capital Carrier XX"
    When commit f400a0b was created
    Then all names were replaced with real vessels: Ever Given, MSC Irina, Maersk Mc-Kinney, CMA CGM Jacques Saade, HMM Algeciras, ONE Triton, etc.
    And voyage numbers were derived from vessel name prefixes

  Scenario: Add cache busting and Cache-Control headers for mock data
    Given the browser cached mock/db.json and showed stale vessel names
    When commit cdb1257 was created
    Then fetch('/mock/db.json?t=' + Date.now()) added cache busting
    And Cache-Control: no-cache, no-store, must-revalidate was set for JSON files

  Scenario: Replace Demo Vessel synthetic names with real vessel names
    Given buildSyntheticSchedules() returned "Demo Vessel 1/2/3" fallback
    When commit d1e7132 was created
    Then the fallback was replaced with 6 real vessels cycled across synthetic schedules

  # --- Session 5: Spec & Gherkin ---

  Scenario: Add Gherkin feature files for all services
    Given no specification or Gherkin files existed in the repository
    When commit 6b6635f was created
    Then 5 feature files were added covering 95+ scenarios
    And the specs covered schedules, quotes, equipments, users, and booking

  Scenario: Add Playwright E2E test suite
    Given no executable end-to-end tests existed
    When commit 86bb3f7 was created
    Then Playwright was installed with chromium
    And e2e/flows.spec.js was created with tests for login, search, quote, booking, logout, datalist, and readonly behaviors
    And a playwright.config.js targets the deployed gateway URL
    And the test:e2e script was added to package.json
    And new commits must be described as Gherkin scenarios in git-history.feature before pushing

  # --- Session 6: Schedules Integration ---

  Scenario: Replace mock schedules with live Azure schedules service
    Given the app used QUOTES_SCHEDULE_STUBS and mock/db.json for schedule data
    When commit add-schedules-integration was created
    Then /api/schedules proxy route was added to server.js pointing to app-schedules-prod-9e31c1
    And SchedulesAPI.search() now maps query params (originPort, destinationPort, departureDateFrom, departureDateTo)
    And SchedulesAPI.search() maps cargoCutOff to cutoffDate in responses
    And getScheduleById() tries the live API before falling back to mock data

  Scenario: Inject schedules JWT from gateway proxy
    Given the schedules service requires Bearer auth with HS256 JWT
    And the gateway proxy forwarded requests without an Authorization header
    When commit inject-schedules-jwt was created
    Then generateSchedulesToken() was added to server.js, signing HS256 JWTs with SCHEDULES_AUTH_SECRET
    And the proxy handler now injects a schedules:read Bearer token for GET requests to /schedules
    And the proxy handler now injects a schedules:read+schedules:modify Bearer token for POST/PUT/PATCH/DELETE to /schedules
