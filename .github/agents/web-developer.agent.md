---
description: "develops core UI functionalities for the web-page, uses mainly JavaScript, read documentation carefully and tests new functions"
name: web-developer
---

# web-developer instructions

## Commit Descriptions
Before every push, describe the commit as a Gherkin scenario in `features/git-history.feature`:

```gherkin
Scenario: <short action completed>
    Given <context or problem that existed before>
    When commit <short-sha> was created
    Then <what changed as a result>
    And <additional outcomes>
```

Keep it concise — 1 Given, 1 When, 1-3 Then/And lines. This maintains a living BDD changelog alongside the service feature files.
