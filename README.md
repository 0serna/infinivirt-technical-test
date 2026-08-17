# Support Ticketing

Internal platform for registering, assigning, and tracking customer support tickets.

## Run locally

```bash
cp .env.example .env
docker compose up --build
```

Leave `DATABASE_URL` on hostname `postgres` and port `5432`. That name only exists inside Compose.

Host ports: API `3000`, web `5173`, Postgres `POSTGRES_PORT` (default `5432`). Compose does not remap `3000` or `5173`; free them or edit `compose.yaml`. If host `5432` is taken, set `POSTGRES_PORT` in `.env` (for example `15432`). Do not point `.env` `DATABASE_URL` at `localhost` or the API container cannot reach Postgres.

Migrations run when the API container starts. Seed does not. After the stack is up:

```bash
npm ci
DATABASE_URL=postgresql://support:support@localhost:${POSTGRES_PORT:-5432}/support_ticketing npm run db:seed
```

Use the published Postgres port (`docker compose port postgres 5432` if you remapped it). Seed is idempotent.

Web: http://localhost:5173 · API: http://localhost:3000

Stop with `docker compose down`.

## Demo users

| Email | Role | Password |
| --- | --- | --- |
| `agent@example.com` | agent | `DemoPassword123!` |
| `supervisor@example.com` | supervisor | `DemoPassword123!` |
| `admin@example.com` | admin | `DemoPassword123!` |

Passwords are stored as bcrypt hashes (cost ~10). The plaintext above is for local login only.

Sign in at `/login` or `POST /auth/login` with `{ "email", "password" }`. The response is `{ accessToken, user }` for `Authorization: Bearer <accessToken>`.

## Host CLI

`npm run db:migrate`, `npm run db:migrate:dev`, and `npm run db:seed` run on the host. They need the localhost `DATABASE_URL` override above, not the Compose URL in `.env`.

## Operational SQL (`queries.sql`)

After migrate + seed:

```bash
docker compose port postgres 5432

docker compose exec -T postgres psql -U support -d support_ticketing < queries.sql
```

From the host, replace `PORT` with the published port:

```bash
PGPASSWORD=support psql -h localhost -p PORT -U support -d support_ticketing -f queries.sql
```

Window, credit, ratio, and reopen semantics live in the comments in `queries.sql`.
