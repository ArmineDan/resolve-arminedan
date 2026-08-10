---
name: pre-release-check
description: Production readiness checklist before releasing features, merging PRs, deploying NestJS microservices or frontend web applications.
allowed-tools: [Bash, Read, Glob, Grep]
---

# Pre-Release & Production Readiness Procedure

Follow this procedure when preparing a feature or service for release/deployment:

1. **Typecheck & Build Validation:**
   - Run TypeScript typechecks across NestJS and Frontend modules (`npm run build` or `npx tsc --noEmit`).
   - Verify zero type errors or missing exports.

2. **Cleanliness & Debugging Artifacts:**
   - Search for left-over `console.log`, `debugger`, or hardcoded local URLs/ports (`localhost:3000`).

3. **Environment & Contract Safety:**
   - Ensure newly added DTOs/Entities in NestJS match the expected API contracts.
   - Check that required environment variables (`.env.example`) are documented.

4. **Produce Release Verdict:**
   - List pass/fail items with clear recommendations.

CRITICAL PROHIBITION:
Do NOT execute git commits or push changes during pre-release audit. Report readiness status only.
