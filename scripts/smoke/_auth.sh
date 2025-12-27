#!/bin/bash
#
# Shared authentication helper for smoke tests
# Source this file at the start of each smoke script
#

set -e

export BASE_URL="${BASE_URL:-http://localhost:3000}"
export SMOKE_EMAIL="${SMOKE_EMAIL:-admin@local}"
export SMOKE_PASSWORD="${SMOKE_PASSWORD:-admin1234}"
export COOKIE_JAR="${COOKIE_JAR:-/tmp/udp_smoke_cookies_$$.txt}"

smoke_auth_cleanup() {
  rm -f "$COOKIE_JAR" 2>/dev/null || true
}
trap smoke_auth_cleanup EXIT

smoke_auth_login() {
  echo "=== Auth: Bootstrap and login ==="

  rm -f "$COOKIE_JAR"

  curl -s -X POST "$BASE_URL/api/auth/bootstrap" > /dev/null 2>&1 || true

  LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -c "$COOKIE_JAR" \
    -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}")

  if ! echo "$LOGIN_RESULT" | jq -e '.success' > /dev/null 2>&1; then
    echo "FAIL: Login failed: $LOGIN_RESULT"
    exit 1
  fi

  echo "PASS: Logged in as $SMOKE_EMAIL"
  echo ""
}

api() {
  local method=$1
  local path=$2
  local data=$3

  if [ -n "$data" ]; then
    curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -b "$COOKIE_JAR" \
      -d "$data"
  else
    curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -b "$COOKIE_JAR"
  fi
}
