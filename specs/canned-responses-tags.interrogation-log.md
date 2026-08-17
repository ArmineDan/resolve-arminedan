# Interrogation Log — Tags & Canned Responses

Retrospective comparison of [`canned-responses-tags.md`](./canned-responses-tags.md)
against what actually shipped. Each entry is a question the spec left open
(or got right up front) and how it was actually resolved during
implementation, with the constraint or evidence that forced the answer.

## Resolved from the spec's own Open Questions

| # | Spec question | Resolution | Why |
|---|---|---|---|
| 1 | Tag names: lowercase-normalized, or case-preserving with case-insensitive comparison? | **Case-preserving storage, case-insensitive comparison.** `billing` and `Billing` are the same tag for duplicate/removal purposes, but whichever casing was first attached is what's stored and returned. | No AC asked for normalization on write, only that duplicates be *rejected* (AC-2) and *matched* on removal (AC-3) case-insensitively. Normalizing would have been an uncalled-for behavior change. |
| 2 | Do unused tags disappear from `GET /tags`, or persist in an independent catalog? | **Derived, not catalogued.** `GET /tags` (`TicketsService.findAllTagNames`) computes distinct names live from the `ticket_tags` table; a tag detached from its last ticket simply stops appearing. There is no separate tag-catalog table. | AC-4 says "attached to at least one ticket" — that's a live-derivation requirement, not a catalog requirement. Simpler, and avoids a second source of truth for tag names. |
| 3 | Can a canned response pre-set the comment's `internal` flag? | **No — left unresolved / not built.** `internal` is still supplied by the caller on `addComment`; canned responses only supply `body`. | Out of scope for the ACs (AC-9/AC-10 only test `body` substitution and audit `cannedResponseId`, never `internal`). Flagging this here since the spec's Non-Goals didn't explicitly rule it out — worth a follow-up decision before Class 4. |

## Ambiguities surfaced only during implementation

**Tag storage model: relation vs. standalone table.**
The natural first design was a `TicketTag` entity with a `@ManyToOne` back
to `Ticket` and an eager `@OneToMany` `tags` relation on `Ticket`, mirroring
how `TicketComment` already works. This broke the *existing*
`tickets.service.spec.ts` test module, which builds its own
`TypeOrmModule.forRoot` with `entities: [Ticket, TicketComment, AuditEntry]`
— no `TicketTag`. TypeORM's schema builder resolves relations at
`DataSource.initialize()` time and requires every related entity class to
be registered in the *same* connection's `entities` array; a decorated
relation pointing at an unregistered entity fails with `Entity metadata for
Ticket#tags was not found`, regardless of whether anything actually reads
the relation.

Since that test file was explicitly off-limits, the relation was dropped in
favor of a **standalone `ticket_tags` table** with a plain `ticketId`
varchar column — the same pattern `AuditEntry` already uses for `ticketId`
rather than a relation. `Ticket.tags` became a bare, undecorated TypeScript
field populated manually by `TicketsRepository` after each fetch, instead
of an ORM-eager relation. This keeps `Ticket`'s own schema completely
unchanged, so no existing `TestingModule` needed to know tags exist at all.

**DI isolation: `CannedResponsesService` and the tag repository as optional dependencies.**
The same test-isolation constraint applied to `CannedResponsesService`:
the pre-existing spec's module never registers it, so a required
constructor parameter on `TicketsService` (and, mirrored, the `TicketTag`
repository on `TicketsRepository`) throws `Nest can't resolve
dependencies...` at `TestingModule.compile()`. Both were changed to
`@Optional()` constructor params. In modules that don't provide them
(only the original spec file), the dependency resolves to `undefined` and
the code paths that need it (`cannedResponseId` on comments, any tag
mutation) are simply never exercised by that file's tests — they don't
need to be reachable, just non-fatal to construct.

**Tag-set deduplication is per-ticket, not global.**
AC-2's "already exists" check is scoped to *that ticket's* tag set
(`ticket.tags.some(...)`), not a global uniqueness constraint on the
`ticket_tags` table — the same tag name (e.g. `billing`) is expected to
appear on many tickets simultaneously; only a second `billing` on the
*same* ticket is rejected. `GET /tags` (AC-4) is what collapses duplicates
across tickets, via a `Set` over all rows' `name` values.

**Canned response title uniqueness required a full-table scan, not a DB constraint.**
AC-7's case-insensitive title uniqueness can't be expressed as a plain SQL
`UNIQUE` constraint without a functional/expression index, which isn't
portable between the Postgres runtime and the `better-sqlite3` test
dialect per the project's dialect-neutrality rule. It's enforced in
`CannedResponsesService.create()` by fetching all existing titles and
comparing lowercased — acceptable at v0 scale, but would need revisiting
if the catalog grows large.

**No maximum tag count was implemented.**
Worth calling out explicitly: neither the spec nor the tests impose a cap
on how many tags a ticket can carry, so none was added. If a limit (e.g.
10 tags/ticket) is wanted, it's a new AC, not something the current
implementation enforces.

**404 vs. 400 boundary for tag removal.**
AC-3 specifies `404` for removing a tag the ticket doesn't have — this
reads as a "the tag doesn't exist *on this ticket*" case, deliberately
distinct from AC-9's `400` for an *unknown `cannedResponseId`* on a
comment. The two "not found" flavors were kept separate rather than
unified under one exception type, since one names a URL path segment
(`DELETE /tickets/:id/tags/:name`) and the other names a request-body
field — matching the existing codebase convention that `404` is for
missing resources addressed by the URL and `400` is for invalid/unknown
values inside a request body.

**Comment body copy-semantics (AC-11) needed to be tested, not just assumed.**
"Deleting a canned response doesn't alter existing comments" only holds if
the comment's `body` is a plain copied string at creation time. This
was already true by construction (`comment.body = body.trim()` — a
primitive string assignment, no reference retained to the `CannedResponse`
row), but it's exactly the kind of invariant that a future refactor (e.g.
"let's just store the `cannedResponseId` on the comment and join at read
time") could silently violate, which is why the spec calls it out as an
explicit invariant rather than leaving it implicit.
