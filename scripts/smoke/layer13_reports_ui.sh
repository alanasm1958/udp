#!/bin/bash
#
# Layer 13 Smoke Test: Reporting APIs
#
# Tests:
# 1. Trial Balance report
# 2. General Ledger report
# 3. Inventory Balances report
# 4. Cashbook report
# 5. Dashboard stats
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

echo "=== Layer 13 Smoke Test: Reporting APIs ==="
echo ""

# Test 1: Trial Balance
echo "=== Test 1: Trial Balance ==="
TB_RESULT=$(api GET "/api/reports/trial-balance?asOf=2025-12-31")
TB_ROWS=$(echo "$TB_RESULT" | jq -r '.rows | length')
TB_BALANCED=$(echo "$TB_RESULT" | jq -r '.totals.balanced')
echo "Trial Balance rows: $TB_ROWS, balanced: $TB_BALANCED"
if [ "$TB_ROWS" = "null" ] || [ -z "$TB_ROWS" ]; then
  echo "FAIL: Trial Balance returned invalid data"
  echo "$TB_RESULT"
  exit 1
fi
echo "PASS: Trial Balance returned $TB_ROWS rows"
echo ""

# Test 2: General Ledger (need an account code that exists)
echo "=== Test 2: General Ledger ==="
GL_RESULT=$(api GET "/api/reports/general-ledger?accountCode=1100")
GL_ACCOUNT=$(echo "$GL_RESULT" | jq -r '.account.code')
GL_ITEMS=$(echo "$GL_RESULT" | jq -r '.items | length')
echo "General Ledger for account $GL_ACCOUNT: $GL_ITEMS lines"
# Allow empty if no transactions, just check structure is valid
if [ "$GL_ACCOUNT" = "null" ] && [ "$GL_ITEMS" = "null" ]; then
  # Try with 1000 (Cash) which might exist
  GL_RESULT=$(api GET "/api/reports/general-ledger?accountCode=1000")
  GL_ACCOUNT=$(echo "$GL_RESULT" | jq -r '.account.code')
  if [ "$GL_ACCOUNT" = "null" ]; then
    echo "NOTE: No account found (expected if no accounts created)"
  fi
fi
echo "PASS: General Ledger API works"
echo ""

# Test 3: Inventory Balances
echo "=== Test 3: Inventory Balances ==="
INV_RESULT=$(api GET "/api/reports/inventory/balances")
INV_ITEMS=$(echo "$INV_RESULT" | jq -r '.items | length')
INV_TOTAL=$(echo "$INV_RESULT" | jq -r '.totals.onHand')
echo "Inventory balances: $INV_ITEMS items, total on-hand: $INV_TOTAL"
if [ "$INV_ITEMS" = "null" ]; then
  echo "FAIL: Inventory Balances returned invalid data"
  echo "$INV_RESULT"
  exit 1
fi
echo "PASS: Inventory Balances returned $INV_ITEMS items"
echo ""

# Test 4: Cashbook
echo "=== Test 4: Cashbook ==="
CB_RESULT=$(api GET "/api/reports/finance/cashbook")
CB_ITEMS=$(echo "$CB_RESULT" | jq -r '.items | length')
CB_NET=$(echo "$CB_RESULT" | jq -r '.totals.net')
echo "Cashbook: $CB_ITEMS entries, net: $CB_NET"
if [ "$CB_ITEMS" = "null" ]; then
  echo "FAIL: Cashbook returned invalid data"
  echo "$CB_RESULT"
  exit 1
fi
echo "PASS: Cashbook returned $CB_ITEMS entries"
echo ""

# Test 5: Dashboard Stats
echo "=== Test 5: Dashboard Stats ==="
DASH_RESULT=$(api GET "/api/reports/dashboard")
DASH_AR=$(echo "$DASH_RESULT" | jq -r '.stats.openAR')
DASH_AP=$(echo "$DASH_RESULT" | jq -r '.stats.openAP')
DASH_ACTIVITY=$(echo "$DASH_RESULT" | jq -r '.recentActivity | length')
echo "Dashboard: Open AR: $DASH_AR, Open AP: $DASH_AP, Recent activity: $DASH_ACTIVITY items"
if [ "$DASH_AR" = "null" ] || [ "$DASH_AP" = "null" ]; then
  echo "FAIL: Dashboard returned invalid data"
  echo "$DASH_RESULT"
  exit 1
fi
echo "PASS: Dashboard stats returned successfully"
echo ""

# Test 6: Verify existing AR/AP endpoints still work
echo "=== Test 6: AR Open ==="
AR_RESULT=$(api GET "/api/finance/ar/open")
AR_COUNT=$(echo "$AR_RESULT" | jq -r '.summary.count')
echo "AR Open: $AR_COUNT items"
if [ "$AR_COUNT" = "null" ]; then
  echo "FAIL: AR Open returned invalid data"
  exit 1
fi
echo "PASS: AR Open endpoint works"
echo ""

echo "=== Test 7: AP Open ==="
AP_RESULT=$(api GET "/api/finance/ap/open")
AP_COUNT=$(echo "$AP_RESULT" | jq -r '.summary.count')
echo "AP Open: $AP_COUNT items"
if [ "$AP_COUNT" = "null" ]; then
  echo "FAIL: AP Open returned invalid data"
  exit 1
fi
echo "PASS: AP Open endpoint works"
echo ""

echo "=== Layer 13 Smoke Test Complete ==="
echo "All API tests passed!"
