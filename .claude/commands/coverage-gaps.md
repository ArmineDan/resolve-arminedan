---
description: Read spec and test suite to list AC with no test, implementation-asserting tests, and highest-value missing test.
allowed-tools: [Read, Glob, Grep]
---

Compare the project specifications/requirements against the test suite to find missing or weak tests.

CRITICAL PROHIBITIONS:
Do NOT write or update any test files. Report findings only.

Output MUST strictly follow this exact Markdown template:

```markdown
# Coverage Gaps Report

## Uncovered Acceptance Criteria
- [AC ID / Description]: [Details or None]

## Implementation vs Behavior Tests
- [Test File]: [Details or None]

## Highest-Value Missing Test
- **Target File:** [File path]
- **Scenario:** [Test scenario description]
- **Rationale:** [Why this test is the highest value]
```
