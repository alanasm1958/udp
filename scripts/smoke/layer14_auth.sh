#!/bin/bash
#
# Layer 14 Smoke Test: Authentication & RBAC
#
# Tests:
# 1. Protected endpoint without auth -> 401
# 2. Bootstrap admin user (dev only)
# 3. Login with admin@local/admin1234
# 4. /api/auth/me with session -> 200
# 5. Protected endpoint with session -> 200
# 6. Admin-only endpoint with admin session -> 200
#

set -e

BASE_URL="http://localhost:3000"
COOKIE_JAR="/tmp/udp_layer14_cookies.txt"

# Cleanup cookie jar
rm -f "$COOKIE_JAR"

# Helper to make API calls
api_no_auth() {
  local method=$1
  local path=$2
  local data=$3

  if [ -n "$data" ]; then
    curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json"
  fi
}

api_with_auth() {
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

echo "=== Layer 14 Smoke Test: Authentication & RBAC ==="
echo ""

# Test 1: Protected endpoint without auth -> 401
echo "=== Test 1: Protected endpoint without auth ==="
UNAUTH_RESULT=$(api_no_auth GET "/api/reports/dashboard")
UNAUTH_ERROR=$(echo "$UNAUTH_RESULT" | jq -r '.error // empty')
if [ "$UNAUTH_ERROR" != "Unauthorized" ]; then
  echo "FAIL: Expected 401 Unauthorized, got: $UNAUTH_RESULT"
  exit 1
fi
echo "PASS: Protected endpoint returns 401 without auth"
echo ""

# Test 2: Bootstrap admin user
echo "=== Test 2: Bootstrap admin user ==="
BOOTSTRAP_RESULT=$(api_no_auth POST "/api/auth/bootstrap" "{}")
BOOTSTRAP_SUCCESS=$(echo "$BOOTSTRAP_RESULT" | jq -r '.success // empty')
BOOTSTRAP_EMAIL=$(echo "$BOOTSTRAP_RESULT" | jq -r '.credentials.email // empty')
if [ "$BOOTSTRAP_SUCCESS" != "true" ]; then
  echo "FAIL: Bootstrap failed: $BOOTSTRAP_RESULT"
  exit 1
fi
echo "PASS: Bootstrap completed (email: $BOOTSTRAP_EMAIL)"
echo ""

# Test 3: Login with admin@local/admin1234
echo "=== Test 3: Login ==="
LOGIN_RESULT=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d '{"email":"admin@local","password":"admin1234"}')
LOGIN_SUCCESS=$(echo "$LOGIN_RESULT" | jq -r '.success // empty')
LOGIN_EMAIL=$(echo "$LOGIN_RESULT" | jq -r '.user.email // empty')
LOGIN_ROLES=$(echo "$LOGIN_RESULT" | jq -r '.user.roles | join(", ") // empty')
if [ "$LOGIN_SUCCESS" != "true" ]; then
  echo "FAIL: Login failed: $LOGIN_RESULT"
  exit 1
fi
echo "PASS: Login successful (email: $LOGIN_EMAIL, roles: $LOGIN_ROLES)"
echo ""

# Verify cookie was saved
if [ ! -f "$COOKIE_JAR" ]; then
  echo "FAIL: Cookie jar not created"
  exit 1
fi
COOKIE_COUNT=$(wc -l < "$COOKIE_JAR" | tr -d ' ')
echo "Cookie jar has $COOKIE_COUNT lines"
echo ""

# Test 4: /api/auth/me with session
echo "=== Test 4: /api/auth/me with session ==="
ME_RESULT=$(api_with_auth GET "/api/auth/me")
ME_EMAIL=$(echo "$ME_RESULT" | jq -r '.user.email // empty')
ME_ROLES=$(echo "$ME_RESULT" | jq -r '.user.roles | join(", ") // empty')
if [ -z "$ME_EMAIL" ] || [ "$ME_EMAIL" = "null" ]; then
  echo "FAIL: /api/auth/me failed: $ME_RESULT"
  exit 1
fi
echo "PASS: /api/auth/me works (email: $ME_EMAIL, roles: $ME_ROLES)"
echo ""

# Test 5: Protected endpoint with session
echo "=== Test 5: Protected endpoint with session ==="
DASH_RESULT=$(api_with_auth GET "/api/reports/dashboard")
DASH_AR=$(echo "$DASH_RESULT" | jq -r '.stats.openAR // empty')
if [ -z "$DASH_AR" ] || [ "$DASH_AR" = "null" ]; then
  echo "FAIL: Dashboard failed with auth: $DASH_RESULT"
  exit 1
fi
echo "PASS: Dashboard works with auth (Open AR: $DASH_AR)"
echo ""

# Test 6: Admin-only endpoint
echo "=== Test 6: Admin-only endpoint ==="
USERS_RESULT=$(api_with_auth GET "/api/admin/users")
USERS_COUNT=$(echo "$USERS_RESULT" | jq -r '.users | length // empty')
if [ -z "$USERS_COUNT" ] || [ "$USERS_COUNT" = "null" ]; then
  echo "FAIL: Admin users endpoint failed: $USERS_RESULT"
  exit 1
fi
echo "PASS: Admin users endpoint works ($USERS_COUNT users)"
echo ""

# Test 7: RBAC-protected endpoint (admin has all access)
echo "=== Test 7: RBAC check (admin can access finance endpoints) ==="
# Try AR open endpoint which requires finance role
AR_RESULT=$(api_with_auth GET "/api/finance/ar/open")
AR_COUNT=$(echo "$AR_RESULT" | jq -r '.summary.count // empty')
if [ -z "$AR_COUNT" ] || [ "$AR_COUNT" = "null" ]; then
  echo "FAIL: AR Open failed for admin: $AR_RESULT"
  exit 1
fi
echo "PASS: Admin can access finance endpoint (AR count: $AR_COUNT)"
echo ""

# Clean up
rm -f "$COOKIE_JAR"

echo "=== Layer 14 Smoke Test Complete ==="
echo "All auth and RBAC tests passed!"
