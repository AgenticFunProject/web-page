Feature: Quotes Service
  As a customer or API client
  I want to request freight price quotes
  So that I can compare prices and proceed to booking

  Background:
    Given the Quotes service has seeded schedule and pricing data

  # --- Quote Creation ---

  Scenario: Create a quote on a seeded peak-season lane
    Given the service has the seeded schedule and reference pricing data
    When a client requests a quote for the Rotterdam to New York schedule
    Then the API returns 201 with the commercial quote response
    And the response includes seasonal and congestion surcharges for that lane
    And the response includes both the internal quote UUID and the public quote reference

  Scenario: Request a quote without optional fields uses defaults
    Given a valid schedule for a quoteable lane
    When a client POSTs /quotes with only scheduleId, equipment, and cargoWeightKg
    Then the API defaults currency to USD
    And the API defaults pricingModeHint to AUTO
    And the quote is priced from public tariff data

  Scenario: Request a quote for an unsupported lane
    Given a seeded schedule that exists but has no effective base rate
    When the client requests a quote for that schedule
    Then the API returns 400
    And the error explains that the lane is not commercially covered

  # --- Quote Retrieval ---

  Scenario: Retrieve a stored quote by internal UUID
    Given a quote has been stored by the service
    When the client GETs /quotes/{id} with the internal UUID
    Then the API returns the full stored quote record
    And the record includes the pricing basis and provenance snapshot

  Scenario: Retrieve a stored quote by public quote reference
    Given a quote has been stored by the service
    When the client GETs /quotes/{id} with the public quoteReference
    Then the API returns the same payload as the UUID lookup

  Scenario: Retrieve a quote by explicit reference endpoint
    Given a quote has been stored with quoteReference "QTE-2026-00108"
    When the client GETs /quotes/reference/QTE-2026-00108
    Then the API returns the same quote payload as the primary lookup path

  # --- Bookability ---

  Scenario: Validate whether a stored quote can still be booked
    Given a quote has been stored by the service
    When Booking asks for the quote's bookability status
    Then the API explains whether the quote is still usable from its validity window
    And the bookability check accepts both the quote UUID and quote reference

  Scenario: Expired quote is not bookable
    Given a quote whose validUntil has passed
    When Booking checks the quote's bookability
    Then the response indicates the quote is not bookable
    And the reason states the validity window has expired

  # --- Coverage Validation ---

  Scenario: Validate rate coverage before requesting a quote
    Given the service stores seeded public tariff coverage by trade lane and equipment type
    When a client POSTs /quotes/coverage/validate with route, date, and equipment
    Then the API explains whether the requested combination is commercially covered
    And the response identifies uncovered equipment types when no effective rate exists

  Scenario: Coverage validation without a schedule id
    Given the service has public tariff data for a trade lane
    When a client validates coverage using originPort, destinationPort, and departureDate
    Then the API validates coverage using the route attributes directly
    And the response does not require a schedule identifier

  # --- Pricing Basis ---

  Scenario: Apply customer contract pricing with surcharge waivers
    Given the service stores seeded customer contract rules for the Rotterdam to New York lane
    When a client requests a quote with customerId for that lane
    Then the API prices the shipment from the matched contract instead of the public tariff
    And the stored quote records the matched contract basis and waived surcharge types

  Scenario: Prefer account contract pricing over customer pricing
    Given both a customer contract and a narrower account contract match the same shipment
    When a client requests a quote with both customerId and accountId
    Then the account contract takes precedence deterministically
    And the resulting quote can differ from the customer-level contract for the same inputs

  Scenario: Fall back to public tariff when contract does not cover all equipment
    Given a customer contract covers some but not all requested equipment types
    When a client requests a quote for that mixed equipment
    Then the API falls back to public tariff pricing for the entire request
    And the quote provenance records the fallback decision

  Scenario: Use approved market pricing when the client hints MARKET
    Given the service stores approved market-rate snapshots for the requested lane
    When a client requests a quote with pricingModeHint set to MARKET
    Then the API prices the base freight from the approved market snapshot
    And the stored quote records the selected market source

  Scenario: Fall back from MARKET to contract or tariff when market coverage is missing
    Given the service cannot fully cover the request from approved market snapshots
    When a client requests a quote with pricingModeHint set to MARKET
    Then the API falls back to the deterministic contract-or-tariff basis
    And the stored optimization trace records that market pricing was unavailable

  # --- Multi-currency ---

  Scenario: Return a quote in a requested display currency
    Given the service stores governed FX data for supported quote currencies
    When a client requests a quote with currency set to EUR
    Then the API keeps the commercial source basis in USD
    And the response exposes the persisted FX snapshot and rounding policy
    And the stored quote records both source and display-currency totals

  # --- Admin: Rate Tables ---

  Scenario: Create, update, and activate a managed rate-table version
    Given the service stores an active public tariff for a quoteable lane
    When a commercial operator creates a draft rate table, updates it, and activates it
    Then later quote requests use the activated version
    And the stored quote provenance records the selected rateVersion

  Scenario: Require actor identity for commercial admin changes
    Given the service exposes managed commercial data admin endpoints
    When a client attempts a change without the X-Actor header
    Then the API rejects the request because the audit actor is required

  Scenario: Draft rate tables are not used for pricing
    Given a draft rate table version exists but is not active
    When a quote request matches that draft's scope
    Then the API prices from the currently active version, not the draft

  Scenario: Activating a rate table deactivates overlapping active versions
    Given an active rate table for a given scope
    When a commercial operator activates a replacement draft for the same scope
    Then the previously active version becomes inactive
    And only the newly activated version is used for pricing

  # --- Admin: Surcharge Rules ---

  Scenario: Create, update, and activate a managed surcharge-rule version
    Given the service stores an active surcharge rule for a quoteable lane
    When a commercial operator creates a draft surcharge rule, updates it, and activates it
    Then later quote requests apply the activated version instead of the superseded one
    And the stored quote provenance records the selected surchargeRuleVersion

  # --- Audit ---

  Scenario: Record an audit trail for managed commercial changes
    Given a commercial operator creates, edits, and activates a managed rate-table version
    When support reads the managed commercial audit trail for that rate table
    Then the API returns the recorded CREATED, UPDATED, and ACTIVATED events
    And each event includes the actor, managed version, and post-change snapshot

  Scenario: Publish managed commercial changes to the outbox
    Given a commercial operator creates, edits, and activates a managed rate-table version
    When an integration consumer reads the outbox feed for rate-table changes
    Then the service returns stable rate.updated events for each managed change
    And each payload includes the commercial action, actor, and resource version

  # --- Explainability ---

  Scenario: Explain why a quote used market or fallback pricing
    Given a quote has been stored with market-pricing explainability data
    When support reads GET /quotes/{id}/explain
    Then the API returns the stored pricing basis, market source, and optimization trace
    And the explainability payload matches the pricing provenance at quote creation time

  Scenario: Reprice an existing quote and explain the commercial variance
    Given a quote has been stored from an earlier commercial snapshot
    And newer commercial data is now active for the same shipment
    When an operator requests a reprice
    Then the service preserves the original quote and stores a distinct repriced result
    And the repriced quote links back to the original quote identifier
    And the response reports the structured variance across base rate, surcharges, and FX
    And the response classifies the overall variance direction as higher, lower, or unchanged

  # --- Quote Lifecycle ---

  Scenario: Persist quote lifecycle events in the outbox
    Given the service stores quote lifecycle state and outbox events together
    When a client creates a quote and that quote later expires
    Then the service persists quote.created and quote.expired events for the same quote
    And each event includes the quote identifiers and commercial snapshot
