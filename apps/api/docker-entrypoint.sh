#!/bin/sh
set -eu

prisma migrate deploy
if [ "${SEED_ON_START:-0}" = "1" ]; then
  prisma db seed
fi
exec node dist/main.js
