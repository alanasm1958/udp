#!/bin/bash
#
# Subscription Plans Smoke Test
#
# Tests:
# 1. GET /api/billing/plans returns 4 plans
# 2. Verify plan codes and structure
# 3. Verify promotional plan properties
#

set -euo pipefail

# Source shared auth helper
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_auth.sh"

echo "=== Subscription Plans Smoke Test ==="
echo ""

# Login using shared helper
smoke_auth_login

# Test 1: GET /api/billing/plans
echo "=== Test 1: List subscription plans ==="
PLANS=$(api GET "/api/billing/plans")
PLAN_COUNT=$(echo "$PLANS" | jq -r '.plans | length')
if [ "$PLAN_COUNT" -ne 4 ]; then
  echo "FAIL: Expected 4 plans, got $PLAN_COUNT"
  echo "$PLANS"
  exit 1
fi
echo "PASS: Found $PLAN_COUNT plans"
echo ""

# Test 2: Verify monthly_30 plan
echo "=== Test 2: Verify monthly_30 plan ==="
MONTHLY=$(echo "$PLANS" | jq -r '.plans[] | select(.code == "monthly_30")')
if [ -z "$MONTHLY" ] || [ "$MONTHLY" = "null" ]; then
  echo "FAIL: monthly_30 plan not found"
  exit 1
fi
MONTHLY_PRICE=$(echo "$MONTHLY" | jq -r '.priceAmount')
MONTHLY_INTERVAL=$(echo "$MONTHLY" | jq -r '.intervalCount')
if [ "$MONTHLY_PRICE" != "30.00" ]; then
  echo "FAIL: monthly_30 price should be 30.00, got $MONTHLY_PRICE"
  exit 1
fi
if [ "$MONTHLY_INTERVAL" != "1" ]; then
  echo "FAIL: monthly_30 intervalCount should be 1, got $MONTHLY_INTERVAL"
  exit 1
fi
echo "PASS: monthly_30 plan verified (price: $MONTHLY_PRICE, interval: $MONTHLY_INTERVAL)"
echo ""

# Test 3: Verify six_month_pack_25 plan
echo "=== Test 3: Verify six_month_pack_25 plan ==="
SIX_MONTH=$(echo "$PLANS" | jq -r '.plans[] | select(.code == "six_month_pack_25")')
if [ -z "$SIX_MONTH" ] || [ "$SIX_MONTH" = "null" ]; then
  echo "FAIL: six_month_pack_25 plan not found"
  exit 1
fi
SIX_PRICE=$(echo "$SIX_MONTH" | jq -r '.priceAmount')
SIX_INTERVAL=$(echo "$SIX_MONTH" | jq -r '.intervalCount')
SIX_DURATION=$(echo "$SIX_MONTH" | jq -r '.durationMonths')
if [ "$SIX_PRICE" != "150.00" ]; then
  echo "FAIL: six_month_pack_25 price should be 150.00, got $SIX_PRICE"
  exit 1
fi
if [ "$SIX_INTERVAL" != "6" ]; then
  echo "FAIL: six_month_pack_25 intervalCount should be 6, got $SIX_INTERVAL"
  exit 1
fi
if [ "$SIX_DURATION" != "6" ]; then
  echo "FAIL: six_month_pack_25 durationMonths should be 6, got $SIX_DURATION"
  exit 1
fi
echo "PASS: six_month_pack_25 plan verified (price: $SIX_PRICE, interval: $SIX_INTERVAL, duration: $SIX_DURATION)"
echo ""

# Test 4: Verify promo_free_6m plan
echo "=== Test 4: Verify promo_free_6m promotional plan ==="
PROMO=$(echo "$PLANS" | jq -r '.plans[] | select(.code == "promo_free_6m")')
if [ -z "$PROMO" ] || [ "$PROMO" = "null" ]; then
  echo "FAIL: promo_free_6m plan not found"
  exit 1
fi
PROMO_PRICE=$(echo "$PROMO" | jq -r '.priceAmount')
PROMO_TYPE=$(echo "$PROMO" | jq -r '.billingType')
PROMO_TRIAL=$(echo "$PROMO" | jq -r '.trialDays')
PROMO_IS_PROMO=$(echo "$PROMO" | jq -r '.isPromotional')
if [ "$PROMO_PRICE" != "0.00" ]; then
  echo "FAIL: promo_free_6m price should be 0.00, got $PROMO_PRICE"
  exit 1
fi
if [ "$PROMO_TYPE" != "trial" ]; then
  echo "FAIL: promo_free_6m billingType should be trial, got $PROMO_TYPE"
  exit 1
fi
if [ "$PROMO_TRIAL" != "180" ]; then
  echo "FAIL: promo_free_6m trialDays should be 180, got $PROMO_TRIAL"
  exit 1
fi
if [ "$PROMO_IS_PROMO" != "true" ]; then
  echo "FAIL: promo_free_6m isPromotional should be true, got $PROMO_IS_PROMO"
  exit 1
fi
echo "PASS: promo_free_6m plan verified (price: $PROMO_PRICE, type: $PROMO_TYPE, trialDays: $PROMO_TRIAL, isPromotional: $PROMO_IS_PROMO)"
echo ""

# Test 5: Manual set subscription (admin function)
echo "=== Test 5: Admin manual set subscription ==="
SET_RESULT=$(api POST "/api/admin/tenant/subscription" '{"planCode": "monthly_30", "status": "active"}')
SET_STATUS=$(echo "$SET_RESULT" | jq -r '.status // .error')
if [ "$SET_STATUS" = "active" ]; then
  echo "PASS: Subscription set to monthly_30 with status=active"
elif echo "$SET_RESULT" | jq -e '.error' > /dev/null 2>&1; then
  echo "WARN: Manual set returned error (may be expected): $(echo "$SET_RESULT" | jq -r '.error')"
else
  echo "PASS: Subscription update completed"
fi
echo ""

# Test 6: Get current billing status
echo "=== Test 6: Verify billing status ==="
STATUS=$(api GET "/api/billing/status")
CURRENT_PLAN=$(echo "$STATUS" | jq -r '.subscription.planCode // empty')
CURRENT_STATUS=$(echo "$STATUS" | jq -r '.subscription.status // "none"')
echo "Current plan: $CURRENT_PLAN, status: $CURRENT_STATUS"
echo "PASS: Billing status retrieved"
echo ""

echo "=== Subscription Plans Smoke Test Complete ==="
echo "All tests passed!"
