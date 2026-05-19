Feature: Booking Service
  As a customer
  I want to submit shipping bookings
  So that my cargo is transported on the selected schedule

  Background:
    Given a valid schedule exists with OPEN status
    And a valid quote has been obtained for that schedule
    And I am authenticated as a registered user

  # --- Booking Submission ---

  Scenario: Submit a booking with valid contact and cargo details
    Given I have a schedule, quote, and equipment selection
    When I POST /api/v1/bookings with contact details and cargo information
    Then the service returns 201
    And the response includes a unique booking reference
    And the booking status is CONFIRMED

  Scenario: Submit a booking with all optional fields
    Given I have a quote and schedule
    When I POST /api/v1/bookings with contactName, contactEmail, contactPhone, cargoDescription, and hsCode
    Then the booking is created successfully
    And all provided fields are recorded

  Scenario: Submit a booking references a valid quote
    Given a quote with id "QTE-2026-00108"
    When I POST a booking referencing that quote
    Then the booking is associated with the quote
    And the quote lifecycle state becomes BOOKED

  Scenario: Submit a booking references a valid schedule
    Given a schedule with id "sch-uuid" in OPEN status
    When I POST a booking referencing that schedule
    Then the booking is associated with the schedule

  # --- Validation ---

  Scenario: Reject booking with missing required fields
    When I POST /api/v1/bookings without contactName
    Then the service returns 400
    And the error lists the missing required fields

  Scenario: Reject booking with invalid email format
    When I POST /api/v1/bookings with contactEmail "not-an-email"
    Then the service returns 400
    And the error explains the email format is invalid

  Scenario: Reject booking for an expired quote
    Given a quote whose validUntil has passed
    When I POST /api/v1/bookings referencing that quote
    Then the service returns 400
    And the error explains that the quote is no longer valid

  Scenario: Reject booking for a closed schedule
    Given a schedule in CLOSED status
    When I POST /api/v1/bookings referencing that schedule
    Then the service returns 400
    And the error explains that the schedule is closed for new bookings

  Scenario: Reject booking with equipment quantity exceeding availability
    Given only 1 container of type 20FT is available
    When I request a booking with quantity 5 of type 20FT
    Then the service returns 409
    And the error explains insufficient container availability

  # --- Booking Lookup ---

  Scenario: Retrieve a booking by its reference
    Given I have submitted a booking with reference "BKG-2026-00001"
    When I GET /api/v1/bookings/BKG-2026-00001
    Then the response returns the booking details
    And the response includes schedule, quote, contact, and cargo information

  Scenario: List bookings for a user
    Given multiple bookings exist for my user account
    When I GET /api/v1/bookings
    Then the response lists my bookings
    And each booking includes its reference, status, schedule, and creation date

  # --- Booking Cancellation ---

  Scenario: Cancel a confirmed booking
    Given a confirmed booking with reference "BKG-2026-00001"
    When I DELETE /api/v1/bookings/BKG-2026-00001
    Then the booking status becomes CANCELLED
    And the equipment reservation is released
    And a booking.cancelled event is emitted

  Scenario: Cannot cancel a booking that is already cancelled
    Given a cancelled booking
    When I attempt to cancel it again
    Then the service returns 409
    And the error explains the booking is already cancelled

  # --- Booking Status Lifecycle ---

  Scenario: Booking progresses through lifecycle states
    Given a new booking is submitted
    Then the status is CONFIRMED
    When the cargo is picked up
    Then the status becomes IN_PROGRESS
    When the vessel departs
    Then the status becomes IN_TRANSIT
    When the cargo arrives at destination
    Then the status becomes COMPLETED
    When cancelled before completion
    Then the status becomes CANCELLED

  # --- Authorization ---

  Scenario: Unauthenticated booking request is rejected
    When I POST /api/v1/bookings without authentication
    Then the service returns 401

  Scenario: A user can only view their own bookings
    Given another user's booking with reference "BKG-2026-00099"
    When I GET /api/v1/bookings/BKG-2026-00099
    Then the service returns 403
    And the error explains I do not own this booking

  # --- Web Portal Flow ---

  Scenario: Full booking flow through the web portal
    Given I am logged in to the customer portal
    When I search for schedules between two ports
    And I select a schedule
    And I request a quote with equipment and cargo details
    And I proceed to booking with my contact and cargo information
    Then I receive a booking confirmation with a reference number
    And the confirmation displays the vessel, route, ETD, and total price
