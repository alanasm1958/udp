#!/bin/bash
#
# Layer 18 Smoke Test: Dashboard API
#
# Tests:
# 1. Dashboard stats with default range (7d)
# 2. Dashboard stats with various ranges (today, 30d, mtd, ytd)
# 3. KPI fields are numeric
# 4. Alerts endpoint
# 5. AI Cards endpoint
#

set -e

TENANT_ID="21106d5d-71bb-4a2a-a0d8-1ea698d37989"
USER_ID="2aaf5a1d-cd8d-4b36-8fcb-0f59c70ef7b4"
BASE_URL="http://localhost:3000"

api() {
  local method=$1
  local path=$2

  curl -s -X "$method" "$BASE_URL$path" \
    -H "Content-Type: application/json" \
    -H "x-tenant-id: $TENANT_ID" \
    -H "x-user-id: $USER_ID"
}

echo "=== Layer 18 Smoke Test: Dashboard API ==="
echo ""

# Test 1: Dashboard stats with default range (7d)
echo "=== Test 1: Dashboard Stats (default 7d range) ==="
DASH_RESULT=$(api GET "/api/reports/dashboard?range=7d")
DASH_AS_OF=$(echo "$DASH_RESULT" | jq -r '.asOfDate')
DASH_RANGE=$(echo "$DASH_RESULT" | jq -r '.dateRange.range')
CASH_VALUE=$(echo "$DASH_RESULT" | jq -r '.kpis.cashToday.value')
AR_VALUE=$(echo "$DASH_RESULT" | jq -r '.kpis.openAR.value')
AP_VALUE=$(echo "$DASH_RESULT" | jq -r '.kpis.openAP.value')
SALES_MTD=$(echo "$DASH_RESULT" | jq -r '.kpis.salesMTD.value')
INV_VALUE=$(echo "$DASH_RESULT" | jq -r '.kpis.inventory.value')

echo "As of: $DASH_AS_OF"
echo "Range: $DASH_RANGE"
echo "Cash Position: $CASH_VALUE"
echo "Open AR: $AR_VALUE"
echo "Open AP: $AP_VALUE"
echo "Sales MTD: $SALES_MTD"
echo "Inventory: $INV_VALUE"

if [ "$DASH_AS_OF" = "null" ] || [ -z "$DASH_AS_OF" ]; then
  echo "FAIL: Dashboard missing asOfDate"
  echo "$DASH_RESULT"
  exit 1
fi

if [ "$DASH_RANGE" != "7d" ]; then
  echo "FAIL: Dashboard range should be 7d, got $DASH_RANGE"
  exit 1
fi

echo "PASS: Dashboard stats returned successfully with 7d range"
echo ""

# Test 2: Dashboard with other ranges
echo "=== Test 2: Dashboard Stats (various ranges) ==="
for range in "today" "30d" "mtd" "ytd"; do
  RESULT=$(api GET "/api/reports/dashboard?range=$range")
  RESULT_RANGE=$(echo "$RESULT" | jq -r '.dateRange.range')
  if [ "$RESULT_RANGE" != "$range" ]; then
    echo "FAIL: Expected range $range, got $RESULT_RANGE"
    exit 1
  fi
  echo "PASS: Range '$range' works correctly"
done
echo ""

# Test 3: Verify KPI values are numeric
echo "=== Test 3: KPI Values are Numeric ==="
# Check that cash value is a number (could be positive, negative, or zero)
if ! echo "$CASH_VALUE" | grep -qE '^-?[0-9]+\.?[0-9]*$'; then
  echo "FAIL: Cash value is not numeric: $CASH_VALUE"
  exit 1
fi
if ! echo "$AR_VALUE" | grep -qE '^-?[0-9]+\.?[0-9]*$'; then
  echo "FAIL: AR value is not numeric: $AR_VALUE"
  exit 1
fi
if ! echo "$AP_VALUE" | grep -qE '^-?[0-9]+\.?[0-9]*$'; then
  echo "FAIL: AP value is not numeric: $AP_VALUE"
  exit 1
fi
echo "PASS: All KPI values are numeric"
echo ""

# Test 4: Recent Activity exists
echo "=== Test 4: Recent Activity ==="
ACTIVITY_COUNT=$(echo "$DASH_RESULT" | jq -r '.recentActivity | length')
echo "Recent activity items: $ACTIVITY_COUNT"
if [ "$ACTIVITY_COUNT" = "null" ]; then
  echo "FAIL: Recent activity is null"
  exit 1
fi
echo "PASS: Recent activity field exists"
echo ""

# Test 5: Alerts endpoint
echo "=== Test 5: Alerts Endpoint ==="
ALERTS_RESULT=$(api GET "/api/grc/alerts")
ALERTS_COUNT=$(echo "$ALERTS_RESULT" | jq -r '.items | length')
ALERTS_TOTAL=$(echo "$ALERTS_RESULT" | jq -r '.total')
ALERTS_GENERATED=$(echo "$ALERTS_RESULT" | jq -r '.generatedAt')

echo "Alerts count: $ALERTS_COUNT"
echo "Alerts total: $ALERTS_TOTAL"
echo "Generated at: $ALERTS_GENERATED"

if [ "$ALERTS_COUNT" = "null" ]; then
  echo "FAIL: Alerts items is null"
  echo "$ALERTS_RESULT"
  exit 1
fi

# Verify alert structure if any alerts exist
if [ "$ALERTS_COUNT" -gt 0 ]; then
  FIRST_ALERT_TYPE=$(echo "$ALERTS_RESULT" | jq -r '.items[0].type')
  FIRST_ALERT_SEVERITY=$(echo "$ALERTS_RESULT" | jq -r '.items[0].severity')
  echo "First alert - Type: $FIRST_ALERT_TYPE, Severity: $FIRST_ALERT_SEVERITY"

  if [ "$FIRST_ALERT_SEVERITY" != "high" ] && [ "$FIRST_ALERT_SEVERITY" != "medium" ] && [ "$FIRST_ALERT_SEVERITY" != "low" ]; then
    echo "FAIL: Invalid severity: $FIRST_ALERT_SEVERITY"
    exit 1
  fi
fi
echo "PASS: Alerts endpoint works"
echo ""

# Test 6: AI Cards endpoint
echo "=== Test 6: AI Cards Endpoint ==="
CARDS_RESULT=$(api GET "/api/ai/cards")
CARDS_COUNT=$(echo "$CARDS_RESULT" | jq -r '.items | length')
CARDS_TOTAL=$(echo "$CARDS_RESULT" | jq -r '.total')

echo "Cards count: $CARDS_COUNT"
echo "Cards total: $CARDS_TOTAL"

if [ "$CARDS_COUNT" = "null" ]; then
  echo "FAIL: Cards items is null"
  echo "$CARDS_RESULT"
  exit 1
fi

echo "PASS: AI Cards endpoint works"
echo ""

echo "=== Layer 18 Smoke Test Complete ==="
echo "All Dashboard API tests passed!"
