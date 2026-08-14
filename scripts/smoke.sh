#!/bin/sh
set -eu

expect_health() {
  url=$1
  body=$(curl -sf --connect-timeout 2 --max-time 5 "$url")
  if [ "$body" != '{"status":"ok"}' ]; then
    echo "unexpected payload from $url: $body" >&2
    exit 1
  fi
  echo "$url ok"
}

expect_health http://localhost:3000/health
expect_health http://localhost:5173/api/health

html=$(curl -sf --connect-timeout 2 --max-time 5 http://localhost:5173/)
case $html in
  *Support\ Ticketing*) echo "http://localhost:5173/ ok" ;;
  *)
    echo "web UI at http://localhost:5173/ did not include Support Ticketing" >&2
    exit 1
    ;;
esac
