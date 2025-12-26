#!/bin/bash
#
# Layer 17: Billing Smoke Tests
#
# Tests subscription plans and tenant subscriptions functionality
#

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR=$(mktemp)

echo "=== Layer 17: Billing Smoke Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# Step 1: Seed plans
echo "=== 1. Seed subscription plans ==="
npm run seed:plans
echo "OK: Plans seeded"
echo ""

# Step 2: Login as admin
echo "=== 2. Login as admin ==="
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d '{"email":"admin@example.com","password":"admin123"}')

if echo "$LOGIN_RESPONSE" | grep -q '"email"'; then
  echo "OK: Logged in as admin"
else
  echo "WARN: Login may have failed, continuing with cookie..."
fi
echo ""

# Step 3: Get billing plans
echo "=== 3. GET /api/billing/plans ==="
PLANS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/billing/plans" \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json")

echo "$PLANS_RESPONSE" | head -c 1000
echo ""

# Check for 3 plans
PLAN_COUNT=$(echo "$PLANS_RESPONSE" | grep -o '"code"' | wc -l)
if [ "$PLAN_COUNT" -ge 3 ]; then
  echo "OK: Found $PLAN_COUNT plans"
else
  echo "FAIL: Expected at least 3 plans, got $PLAN_COUNT"
  exit 1
fi
echo ""

# Step 4: Set OFFER_6M_FREE trialing via admin endpoint
echo "=== 4. POST /api/admin/tenant/subscription (OFFER_6M_FREE trialing) ==="
SET_TRIAL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/tenant/subscription" \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -d '{"planCode":"OFFER_6M_FREE","status":"trialing"}')

echo "$SET_TRIAL_RESPONSE"
echo ""

if echo "$SET_TRIAL_RESPONSE" | grep -q '"success":true'; then
  echo "OK: Subscription set to OFFER_6M_FREE trialing"
else
  echo "FAIL: Could not set subscription"
  exit 1
fi
echo ""

# Step 5: Verify tenant shows subscription
echo "=== 5. GET /api/admin/tenant (verify trialing) ==="
TENANT_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/tenant" \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json")

echo "$TENANT_RESPONSE" | head -c 1000
echo ""

if echo "$TENANT_RESPONSE" | grep -q '"status":"trialing"'; then
  echo "OK: Tenant shows trialing status"
else
  echo "FAIL: Expected trialing status"
  exit 1
fi

if echo "$TENANT_RESPONSE" | grep -q '"planCode":"OFFER_6M_FREE"'; then
  echo "OK: Tenant shows OFFER_6M_FREE plan"
else
  echo "FAIL: Expected OFFER_6M_FREE plan"
  exit 1
fi
echo ""

# Step 6: Set MONTHLY_30 active via admin endpoint
echo "=== 6. POST /api/admin/tenant/subscription (MONTHLY_30 active) ==="
SET_ACTIVE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/admin/tenant/subscription" \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json" \
  -d '{"planCode":"MONTHLY_30","status":"active"}')

echo "$SET_ACTIVE_RESPONSE"
echo ""

if echo "$SET_ACTIVE_RESPONSE" | grep -q '"success":true'; then
  echo "OK: Subscription set to MONTHLY_30 active"
else
  echo "FAIL: Could not set subscription"
  exit 1
fi
echo ""

# Step 7: Verify tenant shows active
echo "=== 7. GET /api/admin/tenant (verify active) ==="
TENANT_RESPONSE2=$(curl -s -X GET "$BASE_URL/api/admin/tenant" \
  -b "$COOKIE_JAR" \
  -H "Content-Type: application/json")

echo "$TENANT_RESPONSE2" | head -c 1000
echo ""

if echo "$TENANT_RESPONSE2" | grep -q '"status":"active"'; then
  echo "OK: Tenant shows active status"
else
  echo "FAIL: Expected active status"
  exit 1
fi

if echo "$TENANT_RESPONSE2" | grep -q '"planCode":"MONTHLY_30"'; then
  echo "OK: Tenant shows MONTHLY_30 plan"
else
  echo "FAIL: Expected MONTHLY_30 plan"
  exit 1
fi
echo ""

# Cleanup
rm -f "$COOKIE_JAR"

echo "=== Layer 17 Smoke Tests PASSED ==="
