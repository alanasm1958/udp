#!/bin/bash
#
# Signup Smoke Tests
#
# Tests user signup flow end-to-end
#

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp)
TIMESTAMP=$(date +%s)

echo "=== Signup Smoke Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Cleanup function
cleanup() {
  rm -f "$COOKIE_JAR"
}
trap cleanup EXIT

# Step 1: Test signup with OFFER_6M_FREE plan
echo "=== 1. Signup with OFFER_6M_FREE plan ==="
SIGNUP_EMAIL="test-trial-${TIMESTAMP}@example.com"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d "{
    \"tenantName\": \"Test Trial Company ${TIMESTAMP}\",
    \"adminName\": \"Test Admin\",
    \"email\": \"${SIGNUP_EMAIL}\",
    \"password\": \"testpass123\",
    \"planCode\": \"OFFER_6M_FREE\"
  }")

echo "$SIGNUP_RESPONSE"
echo ""

if echo "$SIGNUP_RESPONSE" | grep -q '"success":true'; then
  echo "OK: Signup successful with OFFER_6M_FREE"
else
  echo "FAIL: Signup failed"
  exit 1
fi

# Extract tenant ID
TENANT_ID=$(echo "$SIGNUP_RESPONSE" | grep -o '"tenantId":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Tenant ID: $TENANT_ID"
echo ""

# Step 2: Verify session by calling /api/auth/me
echo "=== 2. Verify session via GET /api/auth/me ==="
ME_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/me" \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json")

echo "$ME_RESPONSE"
echo ""

if echo "$ME_RESPONSE" | grep -q "\"email\":\"${SIGNUP_EMAIL}\""; then
  echo "OK: Session is valid, email matches"
else
  echo "FAIL: Session invalid or email mismatch"
  exit 1
fi

if echo "$ME_RESPONSE" | grep -q '"admin"'; then
  echo "OK: User has admin role"
else
  echo "FAIL: User missing admin role"
  exit 1
fi
echo ""

# Step 3: Verify subscription stored correctly
echo "=== 3. Verify tenant subscription ==="
TENANT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/tenant" \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json")

echo "$TENANT_RESPONSE"
echo ""

if echo "$TENANT_RESPONSE" | grep -q '"planCode":"OFFER_6M_FREE"'; then
  echo "OK: Plan code is OFFER_6M_FREE"
else
  echo "FAIL: Plan code mismatch"
  exit 1
fi

if echo "$TENANT_RESPONSE" | grep -q '"status":"trialing"'; then
  echo "OK: Subscription status is trialing"
else
  echo "FAIL: Status should be trialing for trial plan"
  exit 1
fi
echo ""

# Step 4: Test signup with MONTHLY_30 plan (new cookie jar)
COOKIE_JAR2=$(mktemp)
echo "=== 4. Signup with MONTHLY_30 plan ==="
SIGNUP_EMAIL2="test-monthly-${TIMESTAMP}@example.com"
SIGNUP_RESPONSE2=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR2" \
  -d "{
    \"tenantName\": \"Test Monthly Company ${TIMESTAMP}\",
    \"adminName\": \"Test Admin 2\",
    \"email\": \"${SIGNUP_EMAIL2}\",
    \"password\": \"testpass123\",
    \"planCode\": \"MONTHLY_30\"
  }")

echo "$SIGNUP_RESPONSE2"
echo ""

if echo "$SIGNUP_RESPONSE2" | grep -q '"success":true'; then
  echo "OK: Signup successful with MONTHLY_30"
else
  echo "FAIL: Signup failed for MONTHLY_30"
  rm -f "$COOKIE_JAR2"
  exit 1
fi

# Verify subscription for monthly plan
TENANT_RESPONSE2=$(curl -s -X GET "$BASE_URL/api/admin/tenant" \
  -b "$COOKIE_JAR2" \
  -H "Content-Type: application/json")

echo "$TENANT_RESPONSE2"
echo ""

if echo "$TENANT_RESPONSE2" | grep -q '"planCode":"MONTHLY_30"'; then
  echo "OK: Plan code is MONTHLY_30"
else
  echo "FAIL: Plan code mismatch for MONTHLY_30"
  rm -f "$COOKIE_JAR2"
  exit 1
fi

if echo "$TENANT_RESPONSE2" | grep -q '"status":"active"'; then
  echo "OK: Subscription status is active (recurring plan)"
else
  echo "FAIL: Status should be active for recurring plan"
  rm -f "$COOKIE_JAR2"
  exit 1
fi

rm -f "$COOKIE_JAR2"
echo ""

# Step 5: Test duplicate email rejection
echo "=== 5. Test duplicate email rejection ==="
DUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantName\": \"Duplicate Company\",
    \"adminName\": \"Dup Admin\",
    \"email\": \"${SIGNUP_EMAIL}\",
    \"password\": \"testpass123\",
    \"planCode\": \"MONTHLY_30\"
  }")

echo "$DUP_RESPONSE"
echo ""

if echo "$DUP_RESPONSE" | grep -q '"error"'; then
  echo "OK: Duplicate email correctly rejected"
else
  echo "FAIL: Duplicate email should be rejected"
  exit 1
fi
echo ""

# Step 6: Test invalid plan code
echo "=== 6. Test invalid plan code rejection ==="
INVALID_PLAN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenantName\": \"Bad Plan Company\",
    \"adminName\": \"Bad Admin\",
    \"email\": \"badplan-${TIMESTAMP}@example.com\",
    \"password\": \"testpass123\",
    \"planCode\": \"INVALID_PLAN_XYZ\"
  }")

echo "$INVALID_PLAN_RESPONSE"
echo ""

if echo "$INVALID_PLAN_RESPONSE" | grep -q '"error"'; then
  echo "OK: Invalid plan code correctly rejected"
else
  echo "FAIL: Invalid plan code should be rejected"
  exit 1
fi
echo ""

# Step 7: Verify x-tenant-id header is ignored (uses session tenantId)
echo "=== 7. Verify x-tenant-id header is ignored ==="
# Try to access with a fake tenant ID header
FAKE_TENANT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/tenant" \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: 00000000-0000-0000-0000-000000000000")

echo "$FAKE_TENANT_RESPONSE"
echo ""

# Should still return the correct tenant from session
if echo "$FAKE_TENANT_RESPONSE" | grep -q "\"id\":\"${TENANT_ID}\""; then
  echo "OK: x-tenant-id header ignored, session tenantId used"
else
  echo "FAIL: Should use session tenantId, not header"
  exit 1
fi
echo ""

echo "=== Signup Smoke Tests PASSED ==="
