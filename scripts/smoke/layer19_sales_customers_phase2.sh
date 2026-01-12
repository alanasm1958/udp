#!/bin/bash
#
# Sales & Customers Phase 2 Smoke Tests
#
# Tests:
# 1. Walk-in customer idempotent creation
# 2. Salesperson CRUD and Link/Unlink
# 3. Lead promotion (requires multiple invoices, more complex)
#

set -e
source "$(dirname "$0")/_auth.sh"

echo "====================================="
echo " Sales & Customers Phase 2 Smoke Tests"
echo "====================================="
echo ""

smoke_auth_login

#######################################
# Test 1: Walk-in Customer
#######################################
echo "=== Test 1: Walk-in Customer (Idempotent) ==="

# First request - should create or return existing
WALKIN1=$(api GET "/api/sales-customers/customers/walkin")
WALKIN_ID=$(echo "$WALKIN1" | jq -r '.id')
WALKIN_CODE=$(echo "$WALKIN1" | jq -r '.code')

if [ "$WALKIN_CODE" != "WALKIN" ]; then
  echo "FAIL: Walk-in customer code should be 'WALKIN', got: $WALKIN_CODE"
  exit 1
fi
echo "PASS: Walk-in customer created/retrieved (ID: $WALKIN_ID)"

# Second request - should be idempotent (same ID)
WALKIN2=$(api GET "/api/sales-customers/customers/walkin")
WALKIN_ID2=$(echo "$WALKIN2" | jq -r '.id')

if [ "$WALKIN_ID" != "$WALKIN_ID2" ]; then
  echo "FAIL: Walk-in customer should be idempotent. Got different IDs: $WALKIN_ID vs $WALKIN_ID2"
  exit 1
fi
echo "PASS: Walk-in customer is idempotent (same ID returned)"
echo ""

#######################################
# Test 2: Salesperson CRUD
#######################################
echo "=== Test 2: Salesperson CRUD ==="

# Create a salesperson without linking
SP_CREATE=$(api POST "/api/sales-customers/salespersons" \
  '{"name":"Test Salesperson","email":"sales-test@example.com","phone":"555-1234"}')
SP_ID=$(echo "$SP_CREATE" | jq -r '.id')

if [ -z "$SP_ID" ] || [ "$SP_ID" = "null" ]; then
  echo "FAIL: Failed to create salesperson: $SP_CREATE"
  exit 1
fi
echo "PASS: Created salesperson (ID: $SP_ID)"

# List salespersons
SP_LIST=$(api GET "/api/sales-customers/salespersons")
SP_COUNT=$(echo "$SP_LIST" | jq '.items | length')

if [ "$SP_COUNT" -lt 1 ]; then
  echo "FAIL: Salesperson list should have at least 1 item"
  exit 1
fi
echo "PASS: Listed salespersons (count: $SP_COUNT)"
echo ""

#######################################
# Test 3: Salesperson Link/Unlink
#######################################
echo "=== Test 3: Salesperson Link/Unlink ==="

# Get first available user
USERS=$(api GET "/api/admin/users")
USER_ID=$(echo "$USERS" | jq -r '.items[0].id')

if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  echo "SKIP: No users available to test linking"
else
  # Link user to salesperson
  SP_LINKED=$(api PUT "/api/sales-customers/salespersons/$SP_ID" \
    "{\"linkedUserId\":\"$USER_ID\"}")
  LINKED_ID=$(echo "$SP_LINKED" | jq -r '.linkedUserId')

  if [ "$LINKED_ID" != "$USER_ID" ]; then
    echo "FAIL: Salesperson link failed. Expected $USER_ID, got: $LINKED_ID"
    exit 1
  fi
  echo "PASS: Linked salesperson to user (User ID: $USER_ID)"

  # Unlink user
  SP_UNLINKED=$(api PUT "/api/sales-customers/salespersons/$SP_ID" \
    '{"linkedUserId":null}')
  UNLINKED_ID=$(echo "$SP_UNLINKED" | jq -r '.linkedUserId')

  if [ "$UNLINKED_ID" != "null" ]; then
    echo "FAIL: Salesperson unlink failed. Expected null, got: $UNLINKED_ID"
    exit 1
  fi
  echo "PASS: Unlinked salesperson from user"
fi
echo ""

#######################################
# Test 4: Customers List (Verify)
#######################################
echo "=== Test 4: Customers List ==="

CUSTOMERS=$(api GET "/api/sales-customers/customers")
CUST_COUNT=$(echo "$CUSTOMERS" | jq '.items | length')

# Walk-in should be in the list
WALKIN_IN_LIST=$(echo "$CUSTOMERS" | jq ".items[] | select(.code==\"WALKIN\") | .id")

if [ -z "$WALKIN_IN_LIST" ]; then
  echo "FAIL: Walk-in customer should be in customers list"
  exit 1
fi
echo "PASS: Walk-in customer in customers list (total: $CUST_COUNT)"
echo ""

#######################################
# Test 5: Leads Basic CRUD
#######################################
echo "=== Test 5: Leads CRUD ==="

LEAD_CREATE=$(api POST "/api/sales-customers/leads" \
  '{"contactName":"Lead Test","company":"Test Corp","email":"lead@test.com","status":"new"}')
LEAD_ID=$(echo "$LEAD_CREATE" | jq -r '.id')

if [ -z "$LEAD_ID" ] || [ "$LEAD_ID" = "null" ]; then
  echo "FAIL: Failed to create lead: $LEAD_CREATE"
  exit 1
fi
echo "PASS: Created lead (ID: $LEAD_ID)"

LEADS=$(api GET "/api/sales-customers/leads")
LEAD_COUNT=$(echo "$LEADS" | jq '.items | length')

if [ "$LEAD_COUNT" -lt 1 ]; then
  echo "FAIL: Leads list should have at least 1 item"
  exit 1
fi
echo "PASS: Listed leads (count: $LEAD_COUNT)"
echo ""

#######################################
# Summary
#######################################
echo "====================================="
echo " All Phase 2 Smoke Tests PASSED!"
echo "====================================="
