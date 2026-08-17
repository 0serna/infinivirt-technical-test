# Support Ticketing

Internal platform for registering, assigning, and tracking customer support tickets.

```bash
cp .env.example .env
docker compose up --build
```

Web: http://localhost:5173 · API: http://localhost:3000 · Postgres: localhost on `POSTGRES_PORT` (default `5432`)

Stop with `docker compose down`.

Set `JWT_SECRET` (and optionally `JWT_EXPIRES_IN`, default `8h`) in `.env` before starting Compose. The API signs Bearer access tokens with that secret; access lifetime is about one support shift (~8 hours). If host port `5432` is already taken, set `POSTGRES_PORT` in `.env` (for example `15432`).

## Database migrations

Prisma lives in `@support-ticketing/api`. Migrations run on API container startup; seed does not (see `docs/adr/0005-migrate-on-api-startup.md`).

### Host CLI (migrate / seed from your machine)

`.env.example` sets `DATABASE_URL` with hostname `postgres` for Compose. From the host, point at the published Postgres port (`POSTGRES_PORT`, default `5432`) instead:

```bash
DATABASE_URL=postgresql://support:support@localhost:5432/support_ticketing npm run db:migrate
DATABASE_URL=postgresql://support:support@localhost:5432/support_ticketing npm run db:seed
```

- `npm run db:migrate` — apply pending migrations (`prisma migrate deploy`)
- `npm run db:migrate:dev` — create/apply migrations during schema development (`prisma migrate dev`)
- `npm run db:seed` — idempotent domain seed (`prisma db seed`); safe to re-run

### Demo users (seed)

| Email | Role | Password |
| --- | --- | --- |
| `agent@example.com` | agent | `DemoPassword123!` |
| `supervisor@example.com` | supervisor | `DemoPassword123!` |
| `admin@example.com` | admin | `DemoPassword123!` |

Passwords are stored as bcrypt hashes (cost ~10). The plaintext above is documented only for local demo login; it is not written into the database as plaintext.

Staff sign in with `POST /auth/login` (`{ "email", "password" }`) and receive `{ accessToken, user }` suitable for `Authorization: Bearer <accessToken>`.

## Operational SQL (`queries.sql`)

After migrate + seed, run the eight operational queries against Postgres:

```bash
# Detect the published host port if 5432 is already taken (e.g. 15432):
docker compose port postgres 5432

# Via the Compose Postgres container (works regardless of host port mapping):
docker compose exec -T postgres psql -U support -d support_ticketing < queries.sql

# Or from the host with psql (replace PORT with the published port):
PGPASSWORD=support psql -h localhost -p PORT -U support -d support_ticketing -f queries.sql
```

Window, credit, ratio, and reopen semantics live in the comments in `queries.sql`.
