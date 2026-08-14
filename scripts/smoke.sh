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

asset=$(printf '%s\n' "$html" | sed -n 's/.*src="\([^"]*\)".*/\1/p' | head -n 1)
if [ -z "$asset" ]; then
  echo "web UI HTML did not include a script src" >&2
  exit 1
fi
case $asset in
  /*) asset_url="http://localhost:5173$asset" ;;
  *) asset_url="http://localhost:5173/$asset" ;;
esac

js=$(curl -sf --connect-timeout 2 --max-time 5 "$asset_url")
case $js in
  */api/health*) echo "$asset_url uses /api/health" ;;
  *)
    echo "web bundle $asset_url does not call relative /api/health" >&2
    exit 1
    ;;
esac
