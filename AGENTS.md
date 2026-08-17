## Repository Structure

```text
.
├── apps/
│   ├── api/              # NestJS HTTP API
│   └── web/              # React UI served by nginx in Compose
├── packages/
│   └── shared/
├── docs/
│   ├── adr/
│   └── agents/
├── queries.sql           # eight operational SQL queries
└── .github/
    └── workflows/        # CI quality gates
```

## Repository Commands

- `npm run compose:up`: start Postgres, the API, and the web UI with Compose.
- `npm run compose:down`: stop the Compose stack.
- `npm run build`: build workspace packages.
- `npm test`: run workspace tests.
- `npm run test:e2e`: run API end-to-end tests.
- `npm run db:migrate`: apply Prisma migrations (`prisma migrate deploy` in the API workspace).
- `npm run db:migrate:dev`: create/apply Prisma migrations during schema development.
- `npm run db:seed`: idempotent domain seed (`prisma db seed` in the API workspace); not run on API startup.
- `npm run format`: write Biome formatting.
- `npm run format:check`: verify Biome formatting without writing.
- `npm run lint`: lint with Biome; warnings fail the command.
- `npm run lint:fix`: apply Biome safe lint fixes.
- `npm run typecheck`: typecheck all workspaces.

## DATABASE_URL (Compose vs host)

Compose injects `.env` `DATABASE_URL` into the **API container**. That value must use the Compose service hostname and the **container** Postgres port:

- **In `.env` (for `compose:up`)**: `postgresql://support:support@postgres:5432/support_ticketing`
- **Never** put `localhost` (or the published host port) in `.env` `DATABASE_URL` — inside the API container `localhost` is the API itself, not Postgres (`P1001`).
- **`POSTGRES_PORT`** only remaps the **host** publish (`host:container` → e.g. `15432:5432`). It does **not** change the URL inside Compose; keep `:5432` after `@postgres`.
- **Host CLI** (`db:migrate`, `db:seed`, `test:e2e`): override for that command only, e.g.  
  `DATABASE_URL=postgresql://support:support@localhost:${POSTGRES_PORT}/support_ticketing npm run db:seed`  
  Do not rewrite `.env` back to `localhost` to run host tools.

Canonical template: `.env.example`. More detail: README (Host CLI).

## Worktrees

When creating or using a **new** git worktree:

1. Prefer copying `.env.example` → `.env` (or copy another worktree’s `.env` for JWT alignment), set a free `POSTGRES_PORT`, and keep Compose `DATABASE_URL` on `@postgres:5432` (see above). Never commit `.env`.
2. Reassign host-facing ports so they do **not** collide with the primary stack or other worktrees. At minimum set a free `POSTGRES_PORT`. Host CLI uses `localhost` + this worktree’s `POSTGRES_PORT` via command override (see above).
3. Before `compose:up`, confirm the API (`3000`) and web (`5173`) host ports are free for this worktree, or remap those Compose publish ports so this worktree does not fight another stack.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.
