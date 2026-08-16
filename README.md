# Support Ticketing

Internal platform for registering, assigning, and tracking customer support tickets.

```bash
cp .env.example .env
docker compose up --build
```

Web: http://localhost:5173 · API: http://localhost:3000 · Postgres: localhost:5432

Stop with `docker compose down`.

## Database migrations

Prisma lives in `@support-ticketing/api`. The API container runs `prisma migrate deploy` before Nest starts, so `compose:up` applies migrations automatically. Seed is **not** part of startup; run it explicitly when you want demo data.

### Host CLI (migrate / seed from your machine)

`.env.example` sets `DATABASE_URL` with hostname `postgres` for Compose. From the host, point at the published Postgres port instead:

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

## Operational SQL (`db/queries.sql`)

After migrate + seed, run the eight operational queries against Postgres:

```bash
# Detect the published host port if 5432 is already taken (e.g. 15432):
docker compose port postgres 5432

# Via the Compose Postgres container (works regardless of host port mapping):
docker compose exec -T postgres psql -U support -d support_ticketing < db/queries.sql

# Or from the host with psql (replace PORT with the published port):
PGPASSWORD=support psql -h localhost -p PORT -U support -d support_ticketing -f db/queries.sql
```

Queries **4** and **8** share the same rolling window: `NOW() - INTERVAL '30 days'`.

Query **8** is `100 * count(closed_at in window) / count(created_at in window)`. The ratio **may exceed 100%** when more Tickets close in the window than were created in it (for example, backlog closed later than create).

**Reopen caveat:** reopening a Ticket (`closed` → `open`) clears `resolved_at` and `closed_at` on the Ticket projection while status history keeps prior cycles. That can under-count or distort projection-based metrics in queries **4** (resolutions in the last 30 days) and **5** (average resolution time by Priority).
