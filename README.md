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
