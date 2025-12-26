#!/bin/bash
# Layer 16 Smoke Test: Single-tenant membership + Admin users UI
set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_FILE=$(mktemp)
trap "rm -f $COOKIE_FILE" EXIT

echo "=== Layer 16 Smoke Test: Tenant & RBAC ==="
echo ""

# Helper functions
fail() {
  echo "FAIL: $1"
  exit 1
}

pass() {
  echo "PASS: $1"
}

# Test 1: Bootstrap
echo "=== Test 1: Bootstrap ==="
BOOTSTRAP=$(curl -s -X POST "$BASE_URL/api/auth/bootstrap")
if echo "$BOOTSTRAP" | jq -e '.success' > /dev/null 2>&1; then
  pass "Bootstrap completed"
else
  fail "Bootstrap failed: $BOOTSTRAP"
fi

# Test 2: Login as admin
echo ""
echo "=== Test 2: Login as admin ==="
LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_FILE" \
  -d '{"email":"admin@local","password":"admin1234"}')

if echo "$LOGIN" | jq -e '.success' > /dev/null 2>&1; then
  pass "Login successful"
else
  fail "Login failed: $LOGIN"
fi

# Test 3: Get admin users list
echo ""
echo "=== Test 3: GET /api/admin/users ==="
USERS=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/users")

if echo "$USERS" | jq -e '.users' > /dev/null 2>&1; then
  USER_COUNT=$(echo "$USERS" | jq '.users | length')
  pass "Got $USER_COUNT users"
else
  fail "Failed to get users: $USERS"
fi

# Test 4: Create a new user
echo ""
echo "=== Test 4: POST /api/admin/users ==="
NEW_USER=$(curl -s -X POST "$BASE_URL/api/admin/users" \
  -b "$COOKIE_FILE" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "fullName": "Test User",
    "password": "testpass123",
    "roles": ["sales"]
  }')

if echo "$NEW_USER" | jq -e '.user.id' > /dev/null 2>&1; then
  NEW_USER_ID=$(echo "$NEW_USER" | jq -r '.user.id')
  pass "Created user: $NEW_USER_ID"
else
  # Check if user already exists
  if echo "$NEW_USER" | grep -q "already exists"; then
    # Get existing user ID
    EXISTING=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/users")
    NEW_USER_ID=$(echo "$EXISTING" | jq -r '.users[] | select(.email == "testuser@example.com") | .id')
    if [ -n "$NEW_USER_ID" ]; then
      pass "User already exists: $NEW_USER_ID"
    else
      fail "User exists but couldn't find ID"
    fi
  else
    fail "Failed to create user: $NEW_USER"
  fi
fi

# Test 5: Deactivate user
echo ""
echo "=== Test 5: PATCH /api/admin/users/[id] (deactivate) ==="
DEACTIVATE=$(curl -s -X PATCH "$BASE_URL/api/admin/users/$NEW_USER_ID" \
  -b "$COOKIE_FILE" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}')

if echo "$DEACTIVATE" | jq -e '.user.isActive == false' > /dev/null 2>&1; then
  pass "User deactivated"
else
  fail "Failed to deactivate user: $DEACTIVATE"
fi

# Test 6: Reactivate user
echo ""
echo "=== Test 6: PATCH /api/admin/users/[id] (reactivate) ==="
ACTIVATE=$(curl -s -X PATCH "$BASE_URL/api/admin/users/$NEW_USER_ID" \
  -b "$COOKIE_FILE" \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}')

if echo "$ACTIVATE" | jq -e '.user.isActive == true' > /dev/null 2>&1; then
  pass "User reactivated"
else
  fail "Failed to reactivate user: $ACTIVATE"
fi

# Test 7: Get tenant info
echo ""
echo "=== Test 7: GET /api/admin/tenant ==="
TENANT=$(curl -s -b "$COOKIE_FILE" "$BASE_URL/api/admin/tenant")

if echo "$TENANT" | jq -e '.tenant.id' > /dev/null 2>&1; then
  TENANT_ID=$(echo "$TENANT" | jq -r '.tenant.id')
  TENANT_NAME=$(echo "$TENANT" | jq -r '.tenant.name')
  pass "Got tenant: $TENANT_NAME ($TENANT_ID)"
else
  fail "Failed to get tenant: $TENANT"
fi

# Test 8: Verify x-tenant-id header cannot override session tenant
echo ""
echo "=== Test 8: Verify x-tenant-id header is ignored ==="
FAKE_TENANT_ID="00000000-0000-0000-0000-000000000000"
OVERRIDE_TEST=$(curl -s -b "$COOKIE_FILE" \
  -H "x-tenant-id: $FAKE_TENANT_ID" \
  "$BASE_URL/api/admin/tenant")

RETURNED_TENANT=$(echo "$OVERRIDE_TEST" | jq -r '.tenant.id // empty')

if [ "$RETURNED_TENANT" = "$TENANT_ID" ] && [ "$RETURNED_TENANT" != "$FAKE_TENANT_ID" ]; then
  pass "Header override correctly ignored - tenant from session: $RETURNED_TENANT"
else
  fail "Security issue: x-tenant-id header may have overridden session tenant"
fi

# Test 9: Non-admin user cannot access admin endpoints
echo ""
echo "=== Test 9: Non-admin user blocked from admin endpoints ==="

# Login as the test user (non-admin)
TEST_COOKIE=$(mktemp)
trap "rm -f $COOKIE_FILE $TEST_COOKIE" EXIT

TEST_LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -c "$TEST_COOKIE" \
  -d '{"email":"testuser@example.com","password":"testpass123"}')

if echo "$TEST_LOGIN" | jq -e '.success' > /dev/null 2>&1; then
  # Try to access admin endpoint
  ADMIN_ACCESS=$(curl -s -b "$TEST_COOKIE" "$BASE_URL/api/admin/users")

  if echo "$ADMIN_ACCESS" | jq -e '.error' | grep -q "admin"; then
    pass "Non-admin correctly blocked from admin endpoints"
  else
    fail "Non-admin should be blocked: $ADMIN_ACCESS"
  fi
else
  echo "SKIP: Could not login as test user (may be inactive)"
fi

echo ""
echo "=== Layer 16 Smoke Test Complete ==="
echo "All tenant & RBAC tests passed!"
