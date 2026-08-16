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

Host migrate uses `localhost` in `DATABASE_URL`; Compose services use hostname `postgres` (see `.env.example` and README).

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/` at repo root). See `docs/agents/domain.md`.
