# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Resolve" — a NestJS + PostgreSQL (TypeORM) reference implementation of a
minimal ticketing system, built as coursework for "The AI-Native Engineering
Playbook" (ACA). This is v0 ("Core Tickets"); it intentionally does not
implement features slated for later classes (see "Roadmap" below) — don't
build ahead of the current scope.

## Commands

```bash
docker compose up -d db      # start just Postgres for local dev
npm install
npm start                    # ts-node src/main.ts, listens on :3000 (PORT env to change)

npm test                     # jest, runs against in-memory SQLite — no DB needed
npm test -- tickets.service  # run a single spec file (jest matches by path/name)
npm run test:watch

npm run build                # tsc -> dist/
npm run start:prod           # node dist/main.js (run build first)
```

```bash
docker compose up -d --build   # full stack: Postgres 16 + app, recommended for manual/e2e testing
curl localhost:3000/stats
```
Port 3000 busy? `APP_PORT=3300 docker compose up -d --build`. Data lives in
the `pgdata` volume; `docker compose down -v` resets it.

## Architecture

NestJS modules, one per bounded concern, wired together in `app.module.ts`:
`AuditModule`, `TicketsModule`, `StatsModule`, `HealthModule`.

- **Controller → Service → Repository** layering is strict. Controllers stay
  thin (parse request, call service, return result — no business logic).
  Services hold validation and business rules. **Services never touch the
  TypeORM `DataSource`/`Repository` directly** — all data access goes through
  the module's repository class (`TicketsRepository`, `AuditService` acting
  as its own repository).
- **Audit trail is mandatory for mutations.** Every ticket-mutating service
  method calls `AuditService.record(actor, action, ticketId, details)` after
  the write. Action names follow `entity.verb` (`ticket.created`,
  `ticket.status_changed`, `ticket.commented`). The actor comes from the
  `X-Actor` request header (default `'api'` — see `TicketsController`).
- **Status machine**: `ALLOWED_TRANSITIONS` in `tickets.service.ts` is the
  single source of truth —
  `new → open → in_progress → {waiting_customer ↔ in_progress} → resolved → closed`.
  Illegal transitions throw `BadRequestException` naming the allowed next
  states; `changeStatus` is the only place that sets `resolvedAt`.
- **Validation** happens in the service layer as explicit checks that throw
  `BadRequestException` naming the offending field (no class-validator
  DTUs/decorators in this codebase — keep new validation consistent with that
  style, e.g. `tickets.service.ts` `create()`).
- **Dialect-neutral entities**: runtime uses PostgreSQL, tests use in-memory
  `better-sqlite3`, and both must behave identically. Dates are stored as ISO
  strings (`varchar`), not native date/timestamp columns — preserve this when
  adding columns. IDs are app-generated (`newId(prefix)` in `common/ids.ts`,
  e.g. `tkt_xxxxxxxx`, `cmt_xxxxxxxx`), not DB-generated, except
  `AuditEntry.seq` which is an auto-increment ordering column.
- `TypeOrmModule.forRoot` uses `synchronize: true` (see `app.module.ts`) — a
  v0 convenience, not a migration system. Don't introduce TypeORM migrations
  without discussing it; that's an explicitly deferred later-class task.
- Ticket comments are eager-loaded (`Ticket.comments`, `cascade: true,
  eager: true`) and explicitly re-sorted by `seq` in `TicketsRepository`
  after every fetch/save — TypeORM doesn't guarantee relation ordering, so
  don't remove `sortComments()`.
- `internal: true` comments are agent-only notes and must never be filtered
  out or exposed differently to customers by any new customer-facing
  endpoint — there's currently no separate customer-facing view, so if one is
  added it must exclude internal comments.

## Testing conventions

- Tests instantiate a real Nest `TestingModule` with `TypeOrmModule.forRoot({
  type: 'better-sqlite3', database: ':memory:', dropSchema: true,
  synchronize: true, entities: [...] })` and exercise the real
  service + repository — no mocks of our own code (see
  `tickets.service.spec.ts`). Follow this pattern for new module tests rather
  than mocking repositories.
- Jest config lives in `package.json` (`rootDir: src`, test files matched by
  `*.spec.ts`).

## Roadmap (don't build ahead)

Class 3: context kit + tags/canned responses · Class 4: SLA engine
(spec-driven) · Class 5: review gates + triage agent · Class 6: SLA watchdog +
self-healing CI · Class 7: chatbot (RAG), MCP, security hardening · Class 8:
capstone.
