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

`npm run smoke` curls those checks from the host.

## Stop

```bash
docker compose down
```

or `npm run compose:down`.
