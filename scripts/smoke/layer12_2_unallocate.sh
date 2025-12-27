#!/bin/bash
#
# Layer 12.2 Smoke Test: Payment Unallocation
#
# Tests:
# 1. Unallocate by allocationId
# 2. Idempotency - unallocate again
# 3. Unallocate blocked when payment is posted
#

set -e

BASE_URL="${BASE_URL:-http://localhost:3000}"
COOKIE_JAR="${COOKIE_JAR:-/tmp/udp_smoke_cookies.txt}"

echo "=== Layer 12.2 Smoke Test: Payment Unallocation ==="
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

echo "=== Setup: Create test customer ==="
SUFFIX=$(date +%s)
CUST_RESULT=$(api POST "/api/master/parties" "{\"name\": \"Unalloc Test Customer $SUFFIX\", \"type\": \"customer\", \"code\": \"UNALLOC$SUFFIX\"}")
CUST_ID=$(echo "$CUST_RESULT" | jq -r '.id // empty')
if [ -z "$CUST_ID" ]; then
  echo "FAIL: Could not create customer"
  echo "$CUST_RESULT"
  exit 1
fi
echo "PASS: Created customer $CUST_ID"
echo ""

# Test 1: Create invoice, payment, allocate, then unallocate
echo "=== Test 1: Unallocate by allocationId ==="

echo "1a. Create sales invoice..."
SINV=$(api POST "/api/sales/docs" "{\"docType\": \"invoice\", \"docNumber\": \"UNALLOC-$SUFFIX-001\", \"partyId\": \"$CUST_ID\", \"docDate\": \"2025-01-15\", \"totalAmount\": \"250.00\", \"currency\": \"USD\"}")
SINV_ID=$(echo "$SINV" | jq -r '.id')
echo "Created invoice $SINV_ID"

echo "1b. Post the invoice..."
api POST "/api/sales/docs/$SINV_ID/post" '{}' > /dev/null
echo "Invoice posted"

echo "1c. Create draft receipt payment..."
PAY=$(api POST "/api/finance/payments" "{\"type\": \"receipt\", \"amount\": \"250.00\", \"partyId\": \"$CUST_ID\", \"paymentDate\": \"2025-01-20\", \"method\": \"bank\", \"reference\": \"UNALLOC-$SUFFIX-001\"}")
PAY_ID=$(echo "$PAY" | jq -r '.id')
echo "Created payment $PAY_ID"

echo "1d. Allocate payment to invoice..."
ALLOC_RESULT=$(api POST "/api/finance/payments/$PAY_ID/allocations" "{\"allocations\": [{\"targetType\": \"sales_doc\", \"targetId\": \"$SINV_ID\", \"amount\": \"250.00\"}]}")
ALLOC_ID=$(echo "$ALLOC_RESULT" | jq -r '.allocations[0].id')
echo "Allocated, allocationId: $ALLOC_ID"

echo "1e. Verify allocation amount is 250..."
ALLOCS=$(api GET "/api/finance/payments/$PAY_ID/allocations")
AMOUNT=$(echo "$ALLOCS" | jq -r ".allocations[] | select(.id == \"$ALLOC_ID\") | .amount")
echo "Amount before unallocate: $AMOUNT"

echo "1f. Unallocate by allocationId..."
UNALLOC=$(api POST "/api/finance/payments/$PAY_ID/unallocate" "{\"allocationId\": \"$ALLOC_ID\", \"reason\": \"Test unallocation\"}")
echo "Unallocate result: $UNALLOC"
OK=$(echo "$UNALLOC" | jq -r '.ok')
PREV_AMT=$(echo "$UNALLOC" | jq -r '.previousAmount')
if [ "$OK" != "true" ]; then
  echo "FAIL: Unallocate failed"
  exit 1
fi
echo "PASS: Unallocated, previousAmount: $PREV_AMT"

echo "1g. Verify allocation amount is now 0..."
ALLOCS_AFTER=$(api GET "/api/finance/payments/$PAY_ID/allocations")
AMOUNT_AFTER=$(echo "$ALLOCS_AFTER" | jq -r ".allocations[] | select(.id == \"$ALLOC_ID\") | .amount")
echo "Amount after unallocate: $AMOUNT_AFTER"
if [ "$AMOUNT_AFTER" != "0.000000" ]; then
  echo "FAIL: Amount should be 0 after unallocation"
  exit 1
fi
echo "PASS: Amount is 0"
echo ""

# Test 2: Idempotency
echo "=== Test 2: Idempotency ==="

echo "2a. Unallocate same allocation again..."
UNALLOC2=$(api POST "/api/finance/payments/$PAY_ID/unallocate" "{\"allocationId\": \"$ALLOC_ID\"}")
echo "Second unallocate result: $UNALLOC2"
IDEMPOTENT=$(echo "$UNALLOC2" | jq -r '.idempotent')
MSG=$(echo "$UNALLOC2" | jq -r '.message')
if [ "$IDEMPOTENT" != "true" ]; then
  echo "FAIL: Should be idempotent"
  exit 1
fi
echo "PASS: Idempotent=true, message: $MSG"
echo ""

# Test 3: Block unallocation on posted payment
echo "=== Test 3: Block unallocation on posted payment ==="

echo "3a. Create a new invoice for posted payment test..."
SINV2=$(api POST "/api/sales/docs" "{\"docType\": \"invoice\", \"docNumber\": \"UNALLOC-$SUFFIX-002\", \"partyId\": \"$CUST_ID\", \"docDate\": \"2025-01-15\", \"totalAmount\": \"300.00\", \"currency\": \"USD\"}")
SINV2_ID=$(echo "$SINV2" | jq -r '.id')
echo "Created invoice $SINV2_ID"
api POST "/api/sales/docs/$SINV2_ID/post" '{}' > /dev/null
echo "Invoice posted"

echo "3b. Create new draft payment..."
PAY3=$(api POST "/api/finance/payments" "{\"type\": \"receipt\", \"amount\": \"300.00\", \"partyId\": \"$CUST_ID\", \"paymentDate\": \"2025-01-22\", \"method\": \"bank\", \"reference\": \"UNALLOC-$SUFFIX-002\"}")
PAY3_ID=$(echo "$PAY3" | jq -r '.id')
echo "Created payment $PAY3_ID"

echo "3c. Allocate and post..."
ALLOC3_RESULT=$(api POST "/api/finance/payments/$PAY3_ID/allocations" "{\"allocations\": [{\"targetType\": \"sales_doc\", \"targetId\": \"$SINV2_ID\", \"amount\": \"300.00\"}]}")
ALLOC3_ID=$(echo "$ALLOC3_RESULT" | jq -r '.allocations[0].id')
echo "Allocated, allocationId: $ALLOC3_ID"

POST_RESULT=$(api POST "/api/finance/payments/$PAY3_ID/post" '{}')
JE_ID=$(echo "$POST_RESULT" | jq -r '.journalEntryId')
echo "Payment posted, journal entry: $JE_ID"

echo "3d. Try to unallocate posted payment..."
UNALLOC_FAIL=$(api POST "/api/finance/payments/$PAY3_ID/unallocate" "{\"allocationId\": \"$ALLOC3_ID\"}")
echo "Unallocate posted result: $UNALLOC_FAIL"
ERROR=$(echo "$UNALLOC_FAIL" | jq -r '.error')
if [ -z "$ERROR" ] || [ "$ERROR" = "null" ]; then
  echo "FAIL: Should have returned error for posted payment"
  exit 1
fi
echo "PASS: Blocked with error: $ERROR"
echo ""

# Test 4: Unallocate by targetType + targetId
echo "=== Test 4: Unallocate by targetType + targetId ==="

echo "4a. Create another invoice..."
SINV4=$(api POST "/api/sales/docs" "{\"docType\": \"invoice\", \"docNumber\": \"UNALLOC-$SUFFIX-003\", \"partyId\": \"$CUST_ID\", \"docDate\": \"2025-01-15\", \"totalAmount\": \"100.00\", \"currency\": \"USD\"}")
SINV4_ID=$(echo "$SINV4" | jq -r '.id')
echo "Created invoice $SINV4_ID"
api POST "/api/sales/docs/$SINV4_ID/post" '{}' > /dev/null

echo "4b. Create draft payment..."
PAY4=$(api POST "/api/finance/payments" "{\"type\": \"receipt\", \"amount\": \"100.00\", \"partyId\": \"$CUST_ID\", \"paymentDate\": \"2025-01-21\", \"method\": \"cash\", \"reference\": \"UNALLOC-$SUFFIX-003\"}")
PAY4_ID=$(echo "$PAY4" | jq -r '.id')
echo "Created payment $PAY4_ID"

echo "4c. Allocate to invoice..."
api POST "/api/finance/payments/$PAY4_ID/allocations" "{\"allocations\": [{\"targetType\": \"sales_doc\", \"targetId\": \"$SINV4_ID\", \"amount\": \"100.00\"}]}" > /dev/null
echo "Allocated"

echo "4d. Unallocate by targetType + targetId..."
UNALLOC4=$(api POST "/api/finance/payments/$PAY4_ID/unallocate" "{\"targetType\": \"sales_doc\", \"targetId\": \"$SINV4_ID\", \"reason\": \"Test by target\"}")
echo "Unallocate result: $UNALLOC4"
OK4=$(echo "$UNALLOC4" | jq -r '.ok')
if [ "$OK4" != "true" ]; then
  echo "FAIL: Unallocate by target failed"
  exit 1
fi
echo "PASS: Unallocated by targetType + targetId"
echo ""

echo "=== Layer 12.2 Smoke Test Complete ==="
echo "All tests passed!"
