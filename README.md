# Support Ticketing

Internal platform for registering, assigning, and tracking customer support tickets.

```bash
cp .env.example .env
docker compose up --build
```

Web: http://localhost:5173 · API: http://localhost:3000 · Postgres: localhost:5432

Stop with `docker compose down`.

## Database migrations

Prisma lives in `@support-ticketing/api`. The API container runs `prisma migrate deploy` before Nest starts, so `compose:up` applies migrations automatically.

### Host CLI (migrate from your machine)

`.env.example` sets `DATABASE_URL` with hostname `postgres` for Compose. From the host, point at the published Postgres port instead:

```bash
DATABASE_URL=postgresql://support:support@localhost:5432/support_ticketing npm run db:migrate
```

- `npm run db:migrate` — apply pending migrations (`prisma migrate deploy`)
- `npm run db:migrate:dev` — create/apply migrations during schema development (`prisma migrate dev`)
