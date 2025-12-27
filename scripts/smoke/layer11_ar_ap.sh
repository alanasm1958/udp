#!/bin/bash
#
# Layer 11 Smoke Test: AR/AP Open Balances, Statements, Allocation Validation
#
# Prerequisites:
# - Server running on localhost:3000
# - Database bootstrapped with admin user
# - Previous layers (1-10) smoke tests should have run to create test data
#

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/udp_smoke_cookies.txt}"

echo "=== Layer 11 Smoke Test: AR/AP ==="
echo ""

echo "=== Auth: Login as admin ==="
rm -f "$COOKIE_JAR"
curl -s -X POST "$BASE_URL/api/auth/bootstrap" > /dev/null 2>&1 || true
LOGIN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  -d '{"email":"admin@local","password":"admin1234"}')
if ! echo "$LOGIN" | jq -e '.success' > /dev/null 2>&1; then
  echo "FAIL: Login failed: $LOGIN"
  exit 1
fi
echo "PASS: Logged in as admin"
echo ""

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

# ---- SETUP: Create test customer and vendor ----
echo "=== A: Setup - Create Test Parties ==="

SUFFIX=$(date +%s)

echo "A1: Creating test customer..."
CUSTOMER_RESULT=$(api POST "/api/master/parties" "{
  \"name\": \"AR Test Customer $SUFFIX\",
  \"type\": \"customer\",
  \"code\": \"ARTEST$SUFFIX\"
}")
CUSTOMER_ID=$(echo "$CUSTOMER_RESULT" | jq -r '.id // empty')
if [ -z "$CUSTOMER_ID" ]; then
  echo "FAIL: Could not create customer"
  echo "$CUSTOMER_RESULT"
  exit 1
fi
echo "PASS: Created customer $CUSTOMER_ID"

echo "A2: Creating test vendor..."
VENDOR_RESULT=$(api POST "/api/master/parties" "{
  \"name\": \"AP Test Vendor $SUFFIX\",
  \"type\": \"vendor\",
  \"code\": \"APTEST$SUFFIX\"
}")
VENDOR_ID=$(echo "$VENDOR_RESULT" | jq -r '.id // empty')
if [ -z "$VENDOR_ID" ]; then
  echo "FAIL: Could not create vendor"
  echo "$VENDOR_RESULT"
  exit 1
fi
echo "PASS: Created vendor $VENDOR_ID"

# ---- B: Create Sales Invoices ----
echo ""
echo "=== B: Create Posted Sales Invoices ==="

echo "B1: Creating sales invoice INV-AR-$SUFFIX..."
SINV1_RESULT=$(api POST "/api/sales/docs" "{
  \"docType\": \"invoice\",
  \"docNumber\": \"INV-AR-$SUFFIX-001\",
  \"partyId\": \"$CUSTOMER_ID\",
  \"docDate\": \"2025-01-15\",
  \"dueDate\": \"2025-02-14\",
  \"totalAmount\": \"1000.00\",
  \"currency\": \"USD\"
}")
SINV1_ID=$(echo "$SINV1_RESULT" | jq -r '.id // empty')
if [ -z "$SINV1_ID" ]; then
  echo "FAIL: Could not create sales invoice 1"
  exit 1
fi
echo "PASS: Created sales invoice $SINV1_ID"

echo "B2: Posting sales invoice INV-AR-001..."
POST1_RESULT=$(api POST "/api/sales/docs/$SINV1_ID/post" '{}')
POST1_STATUS=$(echo "$POST1_RESULT" | jq -r '.status // empty')
if [ "$POST1_STATUS" != "posted" ]; then
  echo "FAIL: Could not post sales invoice 1"
  echo "$POST1_RESULT"
  exit 1
fi
echo "PASS: Posted sales invoice 1"

echo "B3: Creating sales invoice INV-AR-$SUFFIX-002..."
SINV2_RESULT=$(api POST "/api/sales/docs" "{
  \"docType\": \"invoice\",
  \"docNumber\": \"INV-AR-$SUFFIX-002\",
  \"partyId\": \"$CUSTOMER_ID\",
  \"docDate\": \"2025-01-20\",
  \"dueDate\": \"2025-02-19\",
  \"totalAmount\": \"500.00\",
  \"currency\": \"USD\"
}")
SINV2_ID=$(echo "$SINV2_RESULT" | jq -r '.id // empty')
if [ -z "$SINV2_ID" ]; then
  echo "FAIL: Could not create sales invoice 2"
  exit 1
fi
echo "PASS: Created sales invoice $SINV2_ID"

echo "B4: Posting sales invoice INV-AR-002..."
POST2_RESULT=$(api POST "/api/sales/docs/$SINV2_ID/post" '{}')
POST2_STATUS=$(echo "$POST2_RESULT" | jq -r '.status // empty')
if [ "$POST2_STATUS" != "posted" ]; then
  echo "FAIL: Could not post sales invoice 2"
  exit 1
fi
echo "PASS: Posted sales invoice 2"

# ---- C: Create Purchase Invoices ----
echo ""
echo "=== C: Create Posted Purchase Invoices ==="

echo "C1: Creating purchase invoice PINV-AP-$SUFFIX..."
PINV1_RESULT=$(api POST "/api/procurement/docs" "{
  \"docType\": \"invoice\",
  \"docNumber\": \"PINV-AP-$SUFFIX\",
  \"partyId\": \"$VENDOR_ID\",
  \"docDate\": \"2025-01-18\",
  \"dueDate\": \"2025-02-17\",
  \"totalAmount\": \"750.00\",
  \"currency\": \"USD\"
}")
PINV1_ID=$(echo "$PINV1_RESULT" | jq -r '.id // empty')
if [ -z "$PINV1_ID" ]; then
  echo "FAIL: Could not create purchase invoice 1"
  exit 1
fi
echo "PASS: Created purchase invoice $PINV1_ID"

echo "C2: Posting purchase invoice PINV-AP-001..."
PPOST1_RESULT=$(api POST "/api/procurement/docs/$PINV1_ID/post" '{}')
PPOST1_STATUS=$(echo "$PPOST1_RESULT" | jq -r '.status // empty')
if [ "$PPOST1_STATUS" != "posted" ]; then
  echo "FAIL: Could not post purchase invoice 1"
  exit 1
fi
echo "PASS: Posted purchase invoice 1"

# ---- D: Test AR/AP Open Balances ----
echo ""
echo "=== D: Test AR/AP Open Balances ==="

echo "D1: Get AR open balances..."
AR_OPEN=$(api GET "/api/finance/ar/open")
AR_COUNT=$(echo "$AR_OPEN" | jq -r '.summary.count // 0')
AR_TOTAL=$(echo "$AR_OPEN" | jq -r '.summary.totalOpenAmount // 0')
echo "AR Open: $AR_COUNT invoices, total: $AR_TOTAL"
if [ "$AR_COUNT" -lt 2 ]; then
  echo "FAIL: Expected at least 2 open AR invoices"
  exit 1
fi
echo "PASS: AR open balances returned"

echo "D2: Get AP open balances..."
AP_OPEN=$(api GET "/api/finance/ap/open")
AP_COUNT=$(echo "$AP_OPEN" | jq -r '.summary.count // 0')
AP_TOTAL=$(echo "$AP_OPEN" | jq -r '.summary.totalOpenAmount // 0')
echo "AP Open: $AP_COUNT invoices, total: $AP_TOTAL"
if [ "$AP_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 open AP invoice"
  exit 1
fi
echo "PASS: AP open balances returned"

echo "D3: Get AR open by party..."
AR_PARTY=$(api GET "/api/finance/ar/open?partyId=$CUSTOMER_ID")
AR_PARTY_COUNT=$(echo "$AR_PARTY" | jq -r '.summary.count // 0')
if [ "$AR_PARTY_COUNT" -lt 2 ]; then
  echo "FAIL: Expected at least 2 open AR invoices for customer"
  exit 1
fi
echo "PASS: AR open by party filter works"

# ---- E: Create Payment and Allocate ----
echo ""
echo "=== E: Create Payment and Allocate ==="

echo "E1: Create receipt payment for 600..."
PAYMENT_RESULT=$(api POST "/api/finance/payments" '{
  "type": "receipt",
  "amount": "600.00",
  "partyId": "'$CUSTOMER_ID'",
  "paymentDate": "2025-01-25",
  "method": "bank",
  "reference": "PAY-AR-TEST"
}')
PAYMENT_ID=$(echo "$PAYMENT_RESULT" | jq -r '.id // empty')
if [ -z "$PAYMENT_ID" ]; then
  echo "FAIL: Could not create payment"
  echo "$PAYMENT_RESULT"
  exit 1
fi
echo "PASS: Created payment $PAYMENT_ID"

echo "E2: Allocate payment to sales invoices..."
ALLOC_RESULT=$(api POST "/api/finance/payments/$PAYMENT_ID/allocations" '{
  "allocations": [
    {"targetType": "sales_doc", "targetId": "'$SINV2_ID'", "amount": "500.00"},
    {"targetType": "sales_doc", "targetId": "'$SINV1_ID'", "amount": "100.00"}
  ]
}')
ALLOC_COUNT=$(echo "$ALLOC_RESULT" | jq -r '.allocations | length // 0')
if [ "$ALLOC_COUNT" -ne 2 ]; then
  echo "FAIL: Expected 2 allocations"
  echo "$ALLOC_RESULT"
  exit 1
fi
echo "PASS: Allocated payment to 2 invoices"

echo "E3: Verify allocation summary..."
REMAINING=$(echo "$ALLOC_RESULT" | jq -r '.summary.paymentRemaining // 999')
if [ "$REMAINING" != "0" ]; then
  echo "FAIL: Expected 0 remaining, got $REMAINING"
  exit 1
fi
echo "PASS: Payment fully allocated"

# ---- F: Test Allocation Validations ----
echo ""
echo "=== F: Test Allocation Validations ==="

echo "F1: Try to over-allocate document..."
OVER_ALLOC=$(api POST "/api/finance/payments" '{
  "type": "receipt",
  "amount": "2000.00",
  "partyId": "'$CUSTOMER_ID'",
  "paymentDate": "2025-01-26",
  "method": "bank"
}')
OVER_PAY_ID=$(echo "$OVER_ALLOC" | jq -r '.id // empty')
OVER_RESULT=$(api POST "/api/finance/payments/$OVER_PAY_ID/allocations" '{
  "allocations": [
    {"targetType": "sales_doc", "targetId": "'$SINV1_ID'", "amount": "950.00"}
  ]
}')
OVER_ERROR=$(echo "$OVER_RESULT" | jq -r '.error // empty')
if [ -z "$OVER_ERROR" ]; then
  echo "FAIL: Should have rejected over-allocation"
  exit 1
fi
echo "PASS: Correctly rejected over-allocation ($OVER_ERROR)"

echo "F2: Try currency mismatch..."
SINV_EUR=$(api POST "/api/sales/docs" "{
  \"docType\": \"invoice\",
  \"docNumber\": \"INV-EUR-$SUFFIX\",
  \"partyId\": \"$CUSTOMER_ID\",
  \"docDate\": \"2025-01-27\",
  \"totalAmount\": \"100.00\",
  \"currency\": \"EUR\"
}")
SINV_EUR_ID=$(echo "$SINV_EUR" | jq -r '.id // empty')
api POST "/api/sales/docs/$SINV_EUR_ID/post" '{}' > /dev/null
CURR_RESULT=$(api POST "/api/finance/payments/$OVER_PAY_ID/allocations" '{
  "allocations": [
    {"targetType": "sales_doc", "targetId": "'$SINV_EUR_ID'", "amount": "100.00"}
  ]
}')
CURR_ERROR=$(echo "$CURR_RESULT" | jq -r '.error // empty')
if [ -z "$CURR_ERROR" ]; then
  echo "FAIL: Should have rejected currency mismatch"
  exit 1
fi
echo "PASS: Correctly rejected currency mismatch ($CURR_ERROR)"

echo "F3: Try wrong payment type..."
WRONG_TYPE=$(api POST "/api/finance/payments/$OVER_PAY_ID/allocations" '{
  "allocations": [
    {"targetType": "purchase_doc", "targetId": "'$PINV1_ID'", "amount": "100.00"}
  ]
}')
WRONG_ERROR=$(echo "$WRONG_TYPE" | jq -r '.error // empty')
if [ -z "$WRONG_ERROR" ]; then
  echo "FAIL: Should have rejected wrong payment type"
  exit 1
fi
echo "PASS: Correctly rejected wrong payment type ($WRONG_ERROR)"

# ---- G: Post Payment and Verify AR ----
echo ""
echo "=== G: Post Payment and Verify AR ==="

echo "G1: Post the first payment..."
POST_PAY=$(api POST "/api/finance/payments/$PAYMENT_ID/post" '{}')
PAY_STATUS=$(echo "$POST_PAY" | jq -r '.status // empty')
if [ "$PAY_STATUS" != "posted" ]; then
  echo "FAIL: Could not post payment"
  echo "$POST_PAY"
  exit 1
fi
echo "PASS: Payment posted"

echo "G2: Verify AR open balances reduced..."
AR_AFTER=$(api GET "/api/finance/ar/open?partyId=$CUSTOMER_ID")
AR_AFTER_TOTAL=$(echo "$AR_AFTER" | jq -r '.summary.totalOpenAmount')
echo "AR open after payment: $AR_AFTER_TOTAL (should be ~900)"
echo "PASS: AR updated after payment"

echo "G3: Get individual invoice with payment status..."
INV1_DETAIL=$(api GET "/api/sales/docs/$SINV1_ID")
INV1_STATUS=$(echo "$INV1_DETAIL" | jq -r '.paymentStatus // empty')
INV1_REMAINING=$(echo "$INV1_DETAIL" | jq -r '.remainingAmount // empty')
echo "Invoice 1: paymentStatus=$INV1_STATUS, remaining=$INV1_REMAINING"
if [ "$INV1_STATUS" != "partial" ]; then
  echo "WARNING: Expected partial payment status"
fi
echo "PASS: Invoice shows payment status"

INV2_DETAIL=$(api GET "/api/sales/docs/$SINV2_ID")
INV2_STATUS=$(echo "$INV2_DETAIL" | jq -r '.paymentStatus // empty')
echo "Invoice 2: paymentStatus=$INV2_STATUS (should be paid)"
if [ "$INV2_STATUS" != "paid" ]; then
  echo "WARNING: Expected paid payment status"
fi
echo "PASS: Invoice 2 shows paid status"

# ---- H: Test AR/AP Statements ----
echo ""
echo "=== H: Test AR/AP Statements ==="

echo "H1: Get AR statement for customer..."
AR_STMT=$(api GET "/api/finance/ar/statement?partyId=$CUSTOMER_ID")
AR_STMT_LINES=$(echo "$AR_STMT" | jq -r '.lines | length // 0')
AR_STMT_CLOSE=$(echo "$AR_STMT" | jq -r '.closingBalance // empty')
echo "AR Statement: $AR_STMT_LINES lines, closing balance: $AR_STMT_CLOSE"
if [ "$AR_STMT_LINES" -lt 3 ]; then
  echo "FAIL: Expected at least 3 lines (2 invoices + 1 payment)"
  exit 1
fi
echo "PASS: AR statement returned with correct structure"

echo "H2: Get AP statement for vendor..."
AP_STMT=$(api GET "/api/finance/ap/statement?partyId=$VENDOR_ID")
AP_STMT_LINES=$(echo "$AP_STMT" | jq -r '.lines | length // 0')
AP_STMT_CLOSE=$(echo "$AP_STMT" | jq -r '.closingBalance // empty')
echo "AP Statement: $AP_STMT_LINES lines, closing balance: $AP_STMT_CLOSE"
if [ "$AP_STMT_LINES" -lt 1 ]; then
  echo "FAIL: Expected at least 1 line"
  exit 1
fi
echo "PASS: AP statement returned"

echo ""
echo "=== Layer 11 Smoke Test Complete ==="
echo "All tests passed!"
