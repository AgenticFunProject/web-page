Feature: Users Service
  As an application administrator
  I want to manage local user records
  So that business records can reference stable user identifiers

  Background:
    Given the Users service is running with SQLite-backed persistence

  # --- User Creation ---

  Scenario: Create a local user mapping
    When I POST /users with externalIdentity, displayName, and email
    Then the service returns 201
    And the response includes the stable local user id
    And the id follows the usr_ prefix format

  Scenario: Create a user with optional local password
    When I POST /users with a password field
    Then the user is created with a password hash
    And the password is never returned in any response

  Scenario: Create a user without a local password
    When I POST /users without a password field
    Then the user is created without local authentication capability

  Scenario: Duplicate external identity is rejected
    Given a user exists with externalIdentity "platform-auth:subject-12345"
    When I POST /users with the same externalIdentity
    Then the service returns 409
    And the error explains the duplicate external identity

  # --- User Lookup ---

  Scenario: Get a user by stable local id
    Given a user with id "usr_01HV7M6J7Q3K5M8Y2V9N4A1B2C"
    When I GET /users/usr_01HV7M6J7Q3K5M8Y2V9N4A1B2C
    Then the response returns the user record
    And the record includes id, displayName, email, status, and createdAt

  Scenario: Get a user by external identity
    Given a user with externalIdentity "platform-auth:subject-12345"
    When I GET /users/by-external-identity?externalIdentity=platform-auth:subject-12345
    Then the response returns the matching user record

  Scenario: HEAD returns existence without body
    Given a user exists with externalIdentity "platform-auth:subject-12345"
    When I HEAD /users/by-external-identity?externalIdentity=platform-auth:subject-12345
    Then the response returns 200
    And the response body is empty

  Scenario: HEAD returns 404 when user does not exist
    When I HEAD /users/by-external-identity?externalIdentity=nonexistent
    Then the response returns 404

  Scenario: List users with optional filters
    Given multiple users exist with different statuses
    When I GET /users?status=ACTIVE
    Then the response includes only ACTIVE users

  Scenario: Paginate through users
    Given more than the limit of users exist
    When I GET /users?limit=10&cursor={cursor}
    Then the response returns up to 10 users
    And the response includes a cursor for the next page

  # --- User Updates ---

  Scenario: Update editable profile fields
    Given a user with displayName "Old Name"
    When I PATCH /users/{id} with displayName "New Name"
    Then the user's displayName is updated to "New Name"
    And the id and externalIdentity remain unchanged

  Scenario: Change user status
    Given an ACTIVE user
    When I PATCH /users/{id}/status with status "DISABLED"
    Then the user status becomes DISABLED

  Scenario: Soft-delete a user
    Given an ACTIVE user
    When I PATCH /users/{id}/status with status "DELETED"
    Then the user status becomes DELETED
    And the user record remains retrievable

  Scenario: Disabled user is not assignment-eligible
    Given a DISABLED user
    When I HEAD /users/{id}/assignment-eligible
    Then the response returns 404

  # --- Authentication ---

  Scenario: Authenticate a user with correct password
    Given a user has a local password set
    When I POST /users/{id}/authenticate with the correct password
    Then the response returns 200
    And the user identity is confirmed

  Scenario: Authenticate a user with incorrect password
    Given a user has a local password set
    When I POST /users/{id}/authenticate with an incorrect password
    Then the response returns 401
    And the error message does not reveal whether the user exists

  Scenario: Authenticate a user without a password
    Given a user created without a local password
    When I POST /users/{id}/authenticate with any password
    Then the response returns 400
    And the error explains that this user has no password set

  # --- Bulk Operations ---

  Scenario: Resolve local ids and external identities in bulk
    Given multiple users exist
    When I POST /users/resolve with a list of local ids and external identities
    Then the response returns the resolved user mappings for matching records

  # --- Health Check ---

  Scenario: Health endpoint returns service status
    When I GET /health
    Then the response returns 200
    And the response includes the service status
