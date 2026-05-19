Feature: Equipments Service
  As an operations employee
  I want to manage container equipment and inventory
  So that containers can be reserved, dispatched, tracked, and returned for bookings

  Background:
    Given the Equipments service has seeded equipment types and container inventory
    And I have a valid bearer token with equipments:read and equipments:modify scopes

  # --- Equipment Types (Catalogue) ---

  Scenario: List all equipment types
    When I GET /equipment-types
    Then the response lists all equipment types
    And each type includes its code, description, and max payload

  Scenario: Add a new equipment type to the catalogue
    When I POST /equipment-types with a new type
    Then the service returns 201
    And the new equipment type is available in the catalogue

  Scenario: Update an existing equipment type
    Given an existing equipment type "20FT"
    When I PUT /equipment-types/20FT with updated fields
    Then the service returns 200
    And the equipment type fields are updated

  # --- Container Inventory ---

  Scenario: Register a new container unit
    When I POST /containers with valid container data
    Then the service returns 201
    And the container is created with status AVAILABLE

  Scenario: List containers filtered by type
    Given containers of various types exist in the depot
    When I GET /containers?type=20FT
    Then the response includes only containers of type 20FT

  Scenario: Get a specific container by id
    Given a container with known id exists
    When I GET /containers/{id}
    Then the response returns the full container record

  Scenario: Manual status override for a container
    Given a container in DISPATCHED status
    When I PATCH /containers/{id}/status to set IN_TRANSIT
    Then the container status becomes IN_TRANSIT

  # --- Availability ---

  Scenario: Get available container counts by equipment type
    Given the service has AVAILABLE and RESERVED containers
    When a client GETs /availability
    Then the response lists available counts per equipment type and depot
    And RESERVED containers are not included in available counts

  # --- Reservations ---

  Scenario: Reserve containers for a confirmed booking
    Given sufficient AVAILABLE containers of type 20FT exist
    When I POST /reservations with bookingReference and equipment list
    Then the service returns 201
    And the requested containers are assigned with status RESERVED
    And the response includes the assigned container numbers

  Scenario: Reservation fails atomically when insufficient containers
    Given only 1 container of type 40FT is available
    When I request a reservation for 2 containers of type 40FT
    Then the service returns 409
    And no containers are reserved

  Scenario: Release a reservation when a booking is cancelled
    Given an active reservation for bookingReference "BKG-001"
    When I DELETE /reservations/BKG-001
    Then the reservation status becomes RELEASED
    And the previously RESERVED containers return to AVAILABLE

  Scenario: Consume booking.cancelled event to auto-release reservation
    Given an active reservation for a booking
    When the service receives a booking.cancelled event
    Then the reservation is automatically released
    And the containers return to AVAILABLE

  Scenario: Consume booking.completed event
    Given containers are assigned to a booking
    When the service receives a booking.completed event
    Then the return flow is triggered for those containers

  # --- Container Pickup and Return ---

  Scenario: Record container pickup at origin
    Given a container in RESERVED status
    When I POST /containers/{id}/pickup
    Then the container status becomes DISPATCHED

  Scenario: Pickup fails when container is not RESERVED
    Given a container in AVAILABLE status
    When I POST /containers/{id}/pickup
    Then the service returns 409
    And the error explains that only RESERVED containers can be picked up

  Scenario: Record container return at destination
    Given a container in IN_TRANSIT or DISPATCHED status
    When I POST /containers/{id}/return
    Then the container status becomes RETURNED
    And the container becomes AVAILABLE for future bookings

  Scenario: Return fails when container is not in a shippable status
    Given a container in AVAILABLE status
    When I POST /containers/{id}/return
    Then the service returns 409
    And the error explains the status precondition

  # --- Container Lifecycle ---

  Scenario: Full container lifecycle
    Given a container starts in AVAILABLE status
    When it is reserved for a booking
    Then the status is RESERVED
    When the customer picks it up at origin
    Then the status is DISPATCHED
    When operations marks it in-transit via status override
    Then the status is IN_TRANSIT
    When the container is returned at destination
    Then the status is RETURNED
    And the container is AVAILABLE again

  Scenario: Reservation cancellation returns container to available
    Given a container in RESERVED status
    When the reservation is released
    Then the container status returns to AVAILABLE
    And the booking reference is cleared

  # --- Auth Scopes ---

  Scenario: Unauthenticated requests are rejected
    When I call a protected endpoint without a bearer token
    Then the service returns 401

  Scenario: Read endpoints require equipments:read scope
    Given a bearer token without equipments:read scope
    When I GET /equipment-types
    Then the service returns 403

  Scenario: Write endpoints require equipments:modify scope
    Given a bearer token without equipments:modify scope
    When I POST /equipment-types
    Then the service returns 403

  # --- Dev Utilities (non-production) ---

  Scenario: Reset all data resets to seeded baseline in non-production
    When I POST /dev/reset-all-data in development mode
    Then all runtime data is reset to the seeded baseline
    And the endpoint returns 404 in production mode
