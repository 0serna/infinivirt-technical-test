# Support Ticketing

Internal platform for registering, assigning, and tracking customer support tickets.

## Run locally

Copy the environment file, then start Postgres, the API, and the web UI with Compose:

```bash
cp .env.example .env
docker compose up --build
```

From the repo root you can use the same flow as npm scripts:

```bash
cp .env.example .env
npm run compose:up
```

`.env` is gitignored. `.env.example` lists the Postgres user, password, database name, and `DATABASE_URL` used inside Compose. Do not commit real credentials.

## Ports

| Service  | Address |
| -------- | ------- |
| Postgres | `localhost:5432` |
| API      | `http://localhost:3000` |
| Web      | `http://localhost:5173` |

## Health

When the stack is up:

- `GET http://localhost:3000/health` returns `{"status":"ok"}`
- `GET http://localhost:5173/api/health` returns the same payload through the web proxy
- The UI at `http://localhost:5173` shows that status via relative `/api/health`

`npm run smoke` curls those checks from the host, including that the web bundle calls relative `/api/health`.

## Production target

Local Compose is the day-to-day runtime. Production is AWS, without changing artifact boundaries:

- **API** — the image built from `apps/api` runs as a container (ECS/Fargate or equivalent).
- **Web** — the Vite `dist` is a static SPA (S3 + CloudFront or equivalent). nginx and the `/api` proxy are local-only; in AWS the SPA talks to the API over HTTPS, not Docker DNS.
- **Postgres** — Compose Postgres is replaced by RDS. The same `DATABASE_URL` (and the other names in `.env.example`) stay the config boundary.

Live cloud deploy is a follow-up. Do not treat Compose as the production topology.

## Stop

```bash
docker compose down
```

or `npm run compose:down`.
