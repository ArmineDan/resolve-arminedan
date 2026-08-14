# Architecture

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
