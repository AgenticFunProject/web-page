Feature: Schedules Management
  As an internal employee
  I want to manage vessel sailing schedules
  So that customers can search and book available sailings

  Background:
    Given the Schedules service has seeded schedule data

  # --- Employee CRUD ---

  Scenario: Create a new schedule
    Given I am an authenticated employee
    When I POST a new schedule with valid data
    Then the service returns 201
    And the schedule is created in DRAFT status
    And the response includes the schedule id

  Scenario: Update a draft schedule
    Given an existing schedule in DRAFT status
    When I PUT the schedule with updated fields
    Then the service returns 200
    And the schedule fields are updated

  Scenario: Close an open schedule for new bookings
    Given an existing schedule in OPEN status
    When I PATCH the schedule to close it
    Then the service returns 200
    And the schedule status becomes CLOSED
    And the schedule is no longer returned in public search results

  Scenario: Delete a draft schedule
    Given an existing schedule in DRAFT status
    When I DELETE the schedule
    Then the service returns 204
    And the schedule is removed

  Scenario: Cannot delete a non-draft schedule
    Given an existing schedule in OPEN or CLOSED status
    When I DELETE the schedule
    Then the service returns 409
    And an error explains that only draft schedules can be deleted

  Scenario: Admin can list all schedules including drafts and closed
    Given I am an authenticated employee
    When I GET /schedules with admin view
    Then the response includes schedules in DRAFT, OPEN, and CLOSED status

  # --- Schedule Lifecycle ---

  Scenario: Schedule progresses from DRAFT to OPEN to CLOSED
    Given a schedule is created in DRAFT status
    When an employee publishes the schedule
    Then the schedule becomes OPEN
    When the cargo cut-off passes or an employee manually closes it
    Then the schedule becomes CLOSED
    And no new bookings can be created against it

  Scenario: A closed schedule cannot be re-opened once bookings exist
    Given a CLOSED schedule has confirmed bookings
    When an employee attempts to re-open it
    Then the service rejects the request

  # --- Public Search ---

  Scenario: Search open schedules by origin and destination ports
    Given the service stores open schedules on various trade lanes
    When a client searches with originPort "CNSHA" and destinationPort "NLRTM"
    Then the response lists matching open schedules
    And each schedule includes vesselName, voyageNumber, ETD, ETA, and availableCapacityTEU

  Scenario: Search schedules within a departure date range
    Given the service stores open schedules with various ETD values
    When a client searches with departureDateFrom and departureDateTo
    Then only schedules with ETD within the date range are returned

  Scenario: Search returns only OPEN schedules to unauthenticated clients
    Given the service stores schedules in DRAFT, OPEN, and CLOSED status
    When a client searches without authentication
    Then the response includes OPEN schedules only
    And no DRAFT or CLOSED schedules are returned

  Scenario: Get a specific schedule by id
    Given an open schedule with id "sch-uuid"
    When a client GETs /schedules/sch-uuid
    Then the response returns the full schedule record

  Scenario: No schedules found for an unknown port pair
    Given no schedules exist for origin "XXX" and destination "YYY"
    When a client searches with those ports
    Then the response returns an empty schedules list

  # --- Data Validation ---

  Scenario: Validate business rules on creation
    When I POST a schedule with cargoCutOff after ETD
    Then the service returns 400
    And the error explains that cargoCutOff must be before ETD

  Scenario: Validate ETD before ETA on creation
    When I POST a schedule with ETA before ETD
    Then the service returns 400
    And the error explains that ETA must be after ETD

  Scenario: Voyage number uniqueness
    Given a schedule exists with voyageNumber "EG-2026-001"
    When I POST another schedule with the same voyageNumber
    Then the service returns 409
    And an error explains the duplicate voyage number

  # --- Computed Fields ---

  Scenario: availableCapacityTEU is computed from capacity minus booked TEU
    Given a schedule with capacityTEU 200 and bookedTEU 45
    When a client retrieves the schedule
    Then the response includes availableCapacityTEU equal to 155
