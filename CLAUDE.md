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
npm run build                # tsc -> dist/

docker compose up -d --build # full stack: Postgres 16 + app, for manual/e2e testing
curl localhost:3000/stats
```
Port 3000 busy? `APP_PORT=3300 docker compose up -d --build`. Data lives in
the `pgdata` volume; `docker compose down -v` resets it.

## Architecture

NestJS modules (Controller → Service → Repository, strict layering) wired in
`app.module.ts`; audit trail required on mutations; status machine enforced
in `tickets.service.ts`; dialect-neutral entities (Postgres + SQLite). Full
rules: @docs/architecture.md

## Testing conventions

- Tests instantiate a real Nest `TestingModule` with an in-memory
  `better-sqlite3` DB and exercise the real service + repository — no mocks
  of our own code (see `tickets.service.spec.ts`). Follow this pattern for
  new module tests rather than mocking repositories.

## Roadmap (don't build ahead)

@docs/roadmap.md
