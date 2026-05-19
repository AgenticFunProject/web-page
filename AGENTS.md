## Commit Descriptions

Every commit should be described as a Gherkin scenario in `features/git-history.feature` before pushing. Format:

```gherkin
Scenario: <short action completed>
    Given <context or problem that existed before>
    When commit <short-sha> was created
    Then <what changed as a result>
    And <additional outcomes>
```

This keeps a living BDD-style changelog of the entire development history alongside the service feature files.
