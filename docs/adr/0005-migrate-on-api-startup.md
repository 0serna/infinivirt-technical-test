# Migrate on API container startup

Local Compose runs `prisma migrate deploy` in the API container entrypoint before Nest starts, so a single `compose:up` brings schema and app online. Seed stays an explicit, idempotent command (`db:seed`), not part of startup. The web image stays free of Prisma. A one-shot migrate service or host-only migrate were rejected for local DX: one extra Compose service, or a broken “up and it works” path.
