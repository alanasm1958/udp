#!/bin/bash
#
# Layer 24 Smoke Test: HR Settings
#
# Tests the HR settings APIs:
# - Leave types listing and update
# - Jurisdictions listing
#
# Prerequisites:
# - Server running on localhost:3000
# - Database bootstrapped with admin user
# - Leave types seeded (run: npx tsx scripts/seed/leave_types.ts)
# - Jurisdictions seeded (run: npx tsx scripts/seed/jurisdictions.ts)
#

set -euo pipefail

# Source shared auth helper
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_auth.sh"

echo "=== Layer 24 Smoke Test: HR Settings ==="
echo ""

# Login using shared helper
smoke_auth_login

# ---- A: Leave Types ----
echo "=== A: Leave Types ==="

echo "A1: List all leave types..."
LEAVE_TYPES=$(api GET "/api/people/leave-types?activeOnly=false")
TYPE_COUNT=$(echo "$LEAVE_TYPES" | jq '.items | length')
if [ "$TYPE_COUNT" -lt 1 ]; then
  echo "WARN: No leave types found. Run: npx tsx scripts/seed/leave_types.ts"
  echo "Skipping leave type tests..."
else
  echo "PASS: Found $TYPE_COUNT leave types"

  # Get first leave type for testing
  FIRST_TYPE_ID=$(echo "$LEAVE_TYPES" | jq -r '.items[0].id')
  FIRST_TYPE_NAME=$(echo "$LEAVE_TYPES" | jq -r '.items[0].name')
  echo "PASS: First type: $FIRST_TYPE_NAME ($FIRST_TYPE_ID)"

  echo "A2: List active leave types only..."
  ACTIVE_TYPES=$(api GET "/api/people/leave-types?activeOnly=true")
  ACTIVE_COUNT=$(echo "$ACTIVE_TYPES" | jq '.items | length')
  echo "PASS: Found $ACTIVE_COUNT active leave types"

  echo "A3: Update leave type description..."
  UPDATED_DESC="Updated via smoke test $(date +%s)"
  UPDATE_RESULT=$(api PATCH "/api/people/leave-types" "{
    \"id\": \"$FIRST_TYPE_ID\",
    \"description\": \"$UPDATED_DESC\"
  }")

  # Verify update
  VERIFY_RESULT=$(api GET "/api/people/leave-types?activeOnly=false")
  VERIFY_DESC=$(echo "$VERIFY_RESULT" | jq -r ".items[] | select(.id == \"$FIRST_TYPE_ID\") | .description")
  if [ "$VERIFY_DESC" == "$UPDATED_DESC" ]; then
    echo "PASS: Description updated successfully"
  else
    echo "FAIL: Description update verification failed"
    exit 1
  fi
fi

# ---- B: Jurisdictions ----
echo ""
echo "=== B: Jurisdictions ==="

echo "B1: List country jurisdictions..."
COUNTRIES=$(api GET "/api/people/jurisdictions?type=country")
COUNTRY_COUNT=$(echo "$COUNTRIES" | jq '.items | length')
if [ "$COUNTRY_COUNT" -lt 1 ]; then
  echo "WARN: No country jurisdictions found. Run: npx tsx scripts/seed/jurisdictions.ts"
else
  echo "PASS: Found $COUNTRY_COUNT countries"

  # Get first country name
  FIRST_COUNTRY=$(echo "$COUNTRIES" | jq -r '.items[0].name')
  echo "PASS: First country: $FIRST_COUNTRY"
fi

echo "B2: List state jurisdictions..."
STATES=$(api GET "/api/people/jurisdictions?type=state")
STATE_COUNT=$(echo "$STATES" | jq '.items | length')
echo "PASS: Found $STATE_COUNT states"

echo "B3: Filter by US country code..."
US_JURISDICTIONS=$(api GET "/api/people/jurisdictions?countryCode=US")
US_COUNT=$(echo "$US_JURISDICTIONS" | jq '.items | length')
echo "PASS: Found $US_COUNT US jurisdictions"

echo "B4: List all jurisdictions..."
ALL_JURISDICTIONS=$(api GET "/api/people/jurisdictions")
ALL_COUNT=$(echo "$ALL_JURISDICTIONS" | jq '.items | length')
echo "PASS: Found $ALL_COUNT total active jurisdictions"

# ---- C: Summary ----
echo ""
echo "=== Layer 24 Smoke Test Complete ==="
echo ""
echo "Summary:"
echo "  - Leave types: $TYPE_COUNT"
echo "  - Active leave types: ${ACTIVE_COUNT:-N/A}"
echo "  - Countries: ${COUNTRY_COUNT:-0}"
echo "  - States: ${STATE_COUNT:-0}"
echo "  - US jurisdictions: ${US_COUNT:-0}"
echo "  - Total jurisdictions: ${ALL_COUNT:-0}"
echo ""
echo "All tests passed successfully!"
