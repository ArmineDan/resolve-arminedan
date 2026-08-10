---
description: Read diff and spec to generate a PR description with summary, AC ids, risks, and out-of-scope items.
allowed-tools: [Bash, Read, Glob]
---

Read the git diff and relevant spec files using git commands via Bash. Generate a structured Pull Request description.

CRITICAL PROHIBITIONS:
Do NOT push changes, do NOT execute git commits, and do NOT edit files. Output Markdown text only.

Output MUST strictly follow this exact Markdown template:

```markdown
# Pull Request Description

## Summary
- [Key change]

## Acceptance Criteria Covered
- [AC ID]: [Brief description]

## Reviewer Focus & Risks
- [Risk area or file to double-check]

## Deliberately Out of Scope
- [Out of scope items or None]
```
