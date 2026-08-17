# Support Ticketing

Staff use this to register, assign, and track customer support tickets.

## Stack

TypeScript: NestJS API, Prisma, PostgreSQL, React SPA (Vite, Mantine). Shared types in `packages/shared`.

`apps/api` and `apps/web` share a repo, types, and CI. They deploy as two artifacts (API container, static SPA) so each can scale and release on its own. That split was the plan from the start. The API is stateless: JWT, no server session, so more API instances do not need sticky sessions.

Prisma handles schema and migrations. Operational reporting is `queries.sql`.

Auth is a Bearer JWT (~8h) with no refresh token. The token carries `sub`. Each request loads Role and soft-delete from the database. Roles cascade as an enum: `agent` < `supervisor` < `admin`.

AWS is the destination; Compose is local development. API on ECS/Fargate, SPA on S3 + CloudFront, data on RDS Postgres. Env: `DATABASE_URL`, `JWT_SECRET`.

Implemented in Cursor, in phases close to spec-driven development.

Architecture notes are in `docs/adr/`.

## Run locally

```bash
cp .env.example .env
docker compose up --build
```

Keep `.env` `DATABASE_URL` on `@postgres:5432` (Compose service name). Host ports: web [http://localhost:5173](http://localhost:5173), API [http://localhost:3000](http://localhost:3000), Postgres `POSTGRES_PORT` (default `5432`).

Migrations and the demo seed run when the API container starts (`SEED_ON_START=1`). Set `0` to skip seed.


| Email                    | Role       | Password           |
| ------------------------ | ---------- | ------------------ |
| `agent@example.com`      | agent      | `DemoPassword123!` |
| `supervisor@example.com` | supervisor | `DemoPassword123!` |
| `admin@example.com`      | admin      | `DemoPassword123!` |


## `queries.sql`

```bash
docker compose exec -T postgres psql -U support -d support_ticketing < queries.sql
```

