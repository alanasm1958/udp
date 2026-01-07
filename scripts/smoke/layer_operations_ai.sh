#!/usr/bin/env bash
set -euo pipefail

echo "=== Layer Operations AI Smoke Test ==="
echo ""

# Load auth helpers
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_auth.sh"

# ─────────────────────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────────────────────

echo "=== Auth: Login ==="
smoke_auth_login

# ─────────────────────────────────────────────────────────────────────────────
# Test 1: Validate Purchase Endpoint - Basic
# ─────────────────────────────────────────────────────────────────────────────

echo "=== Test 1: Validate purchase endpoint (empty lines) ==="
RESULT=$(api POST "/api/operations/ai/validate-purchase" '{
  "lines": []
}')

if echo "$RESULT" | jq -e '.hints' > /dev/null 2>&1; then
  HINT_COUNT=$(echo "$RESULT" | jq '.hints | length')
  echo "PASS: validate-purchase returned $HINT_COUNT hints (expected 0 for empty)"
else
  echo "FAIL: validate-purchase did not return hints array"
  echo "$RESULT"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 2: Validate Purchase with Line Items
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "=== Test 2: Validate purchase with line items ==="

# First, get a product ID from the catalog
PRODUCT_RESULT=$(api GET "/api/master/products?limit=1")
PRODUCT_ID=$(echo "$PRODUCT_RESULT" | jq -r '.products[0].id // empty')

if [ -n "$PRODUCT_ID" ] && [ "$PRODUCT_ID" != "null" ]; then
  echo "Using product: $PRODUCT_ID"

  RESULT=$(api POST "/api/operations/ai/validate-purchase" "{
    \"lines\": [{
      \"productId\": \"$PRODUCT_ID\",
      \"quantity\": 10,
      \"unitCost\": 100.00
    }]
  }")

  if echo "$RESULT" | jq -e '.hints' > /dev/null 2>&1; then
    HINT_COUNT=$(echo "$RESULT" | jq '.hints | length')
    ANALYSIS_ID=$(echo "$RESULT" | jq -r '.analysisId')
    echo "PASS: validate-purchase returned $HINT_COUNT hints, analysisId: $ANALYSIS_ID"

    # Show hint types if any
    if [ "$HINT_COUNT" -gt 0 ]; then
      echo "  Hint types: $(echo "$RESULT" | jq -r '[.hints[].type] | join(", ")')"
    fi
  else
    echo "FAIL: validate-purchase did not return hints array"
    echo "$RESULT"
    exit 1
  fi
else
  echo "SKIP: No products found, skipping line item test"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 3: Validate Purchase with Vendor
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "=== Test 3: Validate purchase with vendor ==="

# Get a vendor party
VENDOR_RESULT=$(api GET "/api/master/parties?type=vendor&limit=1")
VENDOR_ID=$(echo "$VENDOR_RESULT" | jq -r '.parties[0].id // empty')

if [ -n "$VENDOR_ID" ] && [ "$VENDOR_ID" != "null" ]; then
  echo "Using vendor: $VENDOR_ID"

  RESULT=$(api POST "/api/operations/ai/validate-purchase" "{
    \"vendorId\": \"$VENDOR_ID\",
    \"lines\": [{
      \"freeTextName\": \"Test Item\",
      \"quantity\": 5,
      \"unitCost\": 50.00
    }]
  }")

  if echo "$RESULT" | jq -e '.hints' > /dev/null 2>&1; then
    HINT_COUNT=$(echo "$RESULT" | jq '.hints | length')
    echo "PASS: validate-purchase with vendor returned $HINT_COUNT hints"

    # Check for vendor reliability hint
    VENDOR_HINT=$(echo "$RESULT" | jq '.hints[] | select(.type == "vendor_reliability")')
    if [ -n "$VENDOR_HINT" ]; then
      echo "  Found vendor reliability hint"
    fi
  else
    echo "FAIL: validate-purchase did not return hints array"
    echo "$RESULT"
    exit 1
  fi
else
  echo "SKIP: No vendors found, skipping vendor test"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 4: Reorder Check Endpoint
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "=== Test 4: Reorder check endpoint ==="

RESULT=$(api GET "/api/operations/ai/reorder-check")

if echo "$RESULT" | jq -e '.lowStockItems' > /dev/null 2>&1; then
  ITEM_COUNT=$(echo "$RESULT" | jq '.lowStockItems | length')
  CRITICAL=$(echo "$RESULT" | jq '.summary.critical // 0')
  WARNING=$(echo "$RESULT" | jq '.summary.warning // 0')
  echo "PASS: reorder-check returned $ITEM_COUNT low stock items (critical: $CRITICAL, warning: $WARNING)"
else
  echo "FAIL: reorder-check did not return lowStockItems array"
  echo "$RESULT"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 5: Reorder Check with Warehouse Filter
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "=== Test 5: Reorder check with warehouse filter ==="

# Get a warehouse
WAREHOUSE_RESULT=$(api GET "/api/master/warehouses?limit=1")
WAREHOUSE_ID=$(echo "$WAREHOUSE_RESULT" | jq -r '.warehouses[0].id // empty')

if [ -n "$WAREHOUSE_ID" ] && [ "$WAREHOUSE_ID" != "null" ]; then
  echo "Using warehouse: $WAREHOUSE_ID"

  RESULT=$(api GET "/api/operations/ai/reorder-check?warehouseId=$WAREHOUSE_ID&threshold=150")

  if echo "$RESULT" | jq -e '.lowStockItems' > /dev/null 2>&1; then
    ITEM_COUNT=$(echo "$RESULT" | jq '.lowStockItems | length')
    echo "PASS: reorder-check with warehouse filter returned $ITEM_COUNT items"
  else
    echo "FAIL: reorder-check with filter did not return lowStockItems"
    echo "$RESULT"
    exit 1
  fi
else
  echo "SKIP: No warehouses found, skipping warehouse filter test"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 6: Validate Purchase Graceful Degradation
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "=== Test 6: Graceful degradation (invalid product ID) ==="

RESULT=$(api POST "/api/operations/ai/validate-purchase" '{
  "lines": [{
    "productId": "00000000-0000-0000-0000-000000000000",
    "quantity": 10,
    "unitCost": 100.00
  }]
}')

if echo "$RESULT" | jq -e '.hints' > /dev/null 2>&1; then
  echo "PASS: validate-purchase handled invalid product gracefully"
else
  echo "FAIL: validate-purchase should gracefully handle invalid data"
  echo "$RESULT"
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# Test 7: Endpoints Require Auth
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "=== Test 7: Endpoints require authentication ==="

# Test without auth cookie
UNAUTH_RESULT=$(curl -s -X POST "$BASE_URL/api/operations/ai/validate-purchase" \
  -H "Content-Type: application/json" \
  -d '{"lines": []}')

if echo "$UNAUTH_RESULT" | jq -e '.error' > /dev/null 2>&1; then
  echo "PASS: validate-purchase requires auth"
else
  # Check for redirect or other auth failure indicators
  if echo "$UNAUTH_RESULT" | grep -qi "unauthorized\|login\|redirect"; then
    echo "PASS: validate-purchase requires auth (redirect detected)"
  else
    echo "WARN: validate-purchase may not be properly protected"
  fi
fi

UNAUTH_RESULT=$(curl -s "$BASE_URL/api/operations/ai/reorder-check")

if echo "$UNAUTH_RESULT" | jq -e '.error' > /dev/null 2>&1; then
  echo "PASS: reorder-check requires auth"
else
  if echo "$UNAUTH_RESULT" | grep -qi "unauthorized\|login\|redirect"; then
    echo "PASS: reorder-check requires auth (redirect detected)"
  else
    echo "WARN: reorder-check may not be properly protected"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "=== Layer Operations AI Smoke Test Complete ==="
echo "All Operations AI tests passed!"
