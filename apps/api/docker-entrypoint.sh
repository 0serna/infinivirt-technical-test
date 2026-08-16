#!/bin/sh
set -eu

prisma migrate deploy
exec node dist/main.js
