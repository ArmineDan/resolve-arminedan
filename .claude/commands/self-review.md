---
description: Review uncommitted diff as a hostile reviewer for conventions, invented behavior, weak tests, and missing edge cases.
allowed-tools: [Bash, Read, Glob, Grep]
---

Review all uncommitted changes (`git status` and `git diff` via Bash) as a strict, hostile code reviewer.

CRITICAL PROHIBITIONS:
Do NOT fix any issues, do NOT create commits, and do NOT modify any files. Report findings only.

Output MUST strictly follow this exact Markdown template. If a section has no issues, explicitly write "None":

```markdown
# Self-Review Report

## 1. Convention & Style Violations
- [File/Line]: [Issue description or None]

## 2. Invented Behavior & Scope Creep
- [File/Line]: [Description or None]

## 3. Edge Cases & Missing Validations
- [Scenario]: [Description or None]

## 4. Test Weaknesses
- [Test File]: [Description or None]
```
