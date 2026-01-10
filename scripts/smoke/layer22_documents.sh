#!/bin/bash
#
# Layer 22 Smoke Test: HR Documents
#
# Tests the complete HR document management workflow:
# - Upload documents with categories
# - Link documents to employees
# - Document verification workflow (verify/reject)
# - Expiry tracking
# - Filter by category and status
#
# Prerequisites:
# - Server running on localhost:3000
# - Database bootstrapped with admin user
# - At least one person/employee exists
#

set -euo pipefail

# Source shared auth helper
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_auth.sh"

echo "=== Layer 22 Smoke Test: HR Documents ==="
echo ""

# Login using shared helper
smoke_auth_login

SUFFIX=$(date +%s)

# ---- A: Setup - Create Test Person and Employee ----
echo "=== A: Setup - Create Test Person and Employee ==="

echo "A1: Creating test person..."
PERSON_RESULT=$(api POST "/api/people" "{
  \"fullName\": \"Doc Test Person $SUFFIX\",
  \"types\": [\"staff\"],
  \"primaryEmail\": \"doctest$SUFFIX@test.local\",
  \"jobTitle\": \"HR Coordinator\"
}")
PERSON_ID=$(echo "$PERSON_RESULT" | jq -r '.id // .personId // empty')
if [ -z "$PERSON_ID" ]; then
  echo "FAIL: Could not create test person"
  echo "$PERSON_RESULT"
  exit 1
fi
echo "PASS: Created test person $PERSON_ID"

echo "A2: Creating test employee record..."
EMP_RESULT=$(api POST "/api/payroll/employees" "{
  \"personId\": \"$PERSON_ID\",
  \"hireDate\": \"2024-01-15\",
  \"employmentType\": \"full_time\",
  \"flsaStatus\": \"exempt\",
  \"federalFilingStatus\": \"single\",
  \"paymentMethod\": \"direct_deposit\",
  \"initialCompensation\": {
    \"payType\": \"salary\",
    \"payRate\": \"65000.00\",
    \"payFrequency\": \"biweekly\",
    \"standardHoursPerWeek\": \"40\"
  }
}")
EMPLOYEE_ID=$(echo "$EMP_RESULT" | jq -r '.employeeId // empty')
if [ -z "$EMPLOYEE_ID" ]; then
  echo "FAIL: Could not create test employee"
  echo "$EMP_RESULT"
  exit 1
fi
echo "PASS: Created test employee $EMPLOYEE_ID"

# ---- B: Upload Documents ----
echo ""
echo "=== B: Upload Documents ==="

echo "B1: Upload ID document (with expiry)..."
EXPIRY_DATE=$(date -v+90d +%Y-%m-%d 2>/dev/null || date -d "+90 days" +%Y-%m-%d)
DOC1_RESULT=$(api POST "/api/people/documents" "{
  \"personId\": \"$PERSON_ID\",
  \"employeeId\": \"$EMPLOYEE_ID\",
  \"storageKey\": \"docs/test/passport_$SUFFIX.pdf\",
  \"sha256\": \"abc123def456$SUFFIX\",
  \"mimeType\": \"application/pdf\",
  \"originalFilename\": \"passport_$SUFFIX.pdf\",
  \"category\": \"id\",
  \"expiryDate\": \"$EXPIRY_DATE\",
  \"expiryAlertDays\": 30,
  \"notes\": \"Test passport document\"
}")
DOC1_ID=$(echo "$DOC1_RESULT" | jq -r '.documentId // empty')
if [ -z "$DOC1_ID" ]; then
  echo "FAIL: Could not upload ID document"
  echo "$DOC1_RESULT"
  exit 1
fi
echo "PASS: Uploaded ID document $DOC1_ID"

echo "B2: Upload contract document (no expiry)..."
DOC2_RESULT=$(api POST "/api/people/documents" "{
  \"personId\": \"$PERSON_ID\",
  \"storageKey\": \"docs/test/contract_$SUFFIX.pdf\",
  \"sha256\": \"xyz789abc$SUFFIX\",
  \"mimeType\": \"application/pdf\",
  \"originalFilename\": \"employment_contract_$SUFFIX.pdf\",
  \"category\": \"contract\",
  \"notes\": \"Employment contract\"
}")
DOC2_ID=$(echo "$DOC2_RESULT" | jq -r '.documentId // empty')
if [ -z "$DOC2_ID" ]; then
  echo "FAIL: Could not upload contract document"
  echo "$DOC2_RESULT"
  exit 1
fi
echo "PASS: Uploaded contract document $DOC2_ID"

echo "B3: Upload certificate document..."
DOC3_RESULT=$(api POST "/api/people/documents" "{
  \"employeeId\": \"$EMPLOYEE_ID\",
  \"storageKey\": \"docs/test/cert_$SUFFIX.pdf\",
  \"sha256\": \"cert123$SUFFIX\",
  \"mimeType\": \"application/pdf\",
  \"originalFilename\": \"certification_$SUFFIX.pdf\",
  \"category\": \"certificate\"
}")
DOC3_ID=$(echo "$DOC3_RESULT" | jq -r '.documentId // empty')
if [ -z "$DOC3_ID" ]; then
  echo "FAIL: Could not upload certificate document"
  echo "$DOC3_RESULT"
  exit 1
fi
echo "PASS: Uploaded certificate document $DOC3_ID"

# ---- C: List and Filter Documents ----
echo ""
echo "=== C: List and Filter Documents ==="

echo "C1: List all documents..."
ALL_DOCS=$(api GET "/api/people/documents?limit=50")
DOC_COUNT=$(echo "$ALL_DOCS" | jq '.items | length')
if [ "$DOC_COUNT" -lt 3 ]; then
  echo "FAIL: Expected at least 3 documents, got $DOC_COUNT"
  echo "$ALL_DOCS"
  exit 1
fi
echo "PASS: Listed $DOC_COUNT documents"

echo "C2: Filter by category (id)..."
ID_DOCS=$(api GET "/api/people/documents?category=id")
ID_COUNT=$(echo "$ID_DOCS" | jq '.items | length')
if [ "$ID_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 ID document"
  exit 1
fi
echo "PASS: Found $ID_COUNT ID documents"

echo "C3: Filter by person..."
PERSON_DOCS=$(api GET "/api/people/documents?personId=$PERSON_ID")
PERSON_DOC_COUNT=$(echo "$PERSON_DOCS" | jq '.items | length')
if [ "$PERSON_DOC_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 document for person"
  exit 1
fi
echo "PASS: Found $PERSON_DOC_COUNT documents for person"

echo "C4: Filter by status (pending)..."
PENDING_DOCS=$(api GET "/api/people/documents?status=pending")
PENDING_COUNT=$(echo "$PENDING_DOCS" | jq '.items | length')
echo "PASS: Found $PENDING_COUNT pending documents"

# ---- D: Get Single Document ----
echo ""
echo "=== D: Get Single Document ==="

echo "D1: Get document details..."
DOC_DETAILS=$(api GET "/api/people/documents/$DOC1_ID")
DOC_CATEGORY=$(echo "$DOC_DETAILS" | jq -r '.category // empty')
DOC_STATUS=$(echo "$DOC_DETAILS" | jq -r '.verificationStatus // empty')
if [ "$DOC_CATEGORY" != "id" ]; then
  echo "FAIL: Expected category 'id', got '$DOC_CATEGORY'"
  exit 1
fi
if [ "$DOC_STATUS" != "pending" ]; then
  echo "FAIL: Expected status 'pending', got '$DOC_STATUS'"
  exit 1
fi
LINKED_ENTITIES=$(echo "$DOC_DETAILS" | jq '.linkedEntities | length')
if [ "$LINKED_ENTITIES" -lt 1 ]; then
  echo "FAIL: Expected at least 1 linked entity"
  exit 1
fi
echo "PASS: Document has category=$DOC_CATEGORY, status=$DOC_STATUS, $LINKED_ENTITIES linked entities"

# ---- E: Verification Workflow ----
echo ""
echo "=== E: Verification Workflow ==="

echo "E1: Verify document 1..."
VERIFY_RESULT=$(api PATCH "/api/people/documents/$DOC1_ID" "{
  \"verificationStatus\": \"verified\"
}")
VERIFIED_STATUS=$(echo "$VERIFY_RESULT" | jq -r '.document.verificationStatus // empty')
if [ "$VERIFIED_STATUS" != "verified" ]; then
  echo "FAIL: Expected status 'verified', got '$VERIFIED_STATUS'"
  echo "$VERIFY_RESULT"
  exit 1
fi
VERIFIED_AT=$(echo "$VERIFY_RESULT" | jq -r '.document.verifiedAt // empty')
if [ -z "$VERIFIED_AT" ]; then
  echo "FAIL: verifiedAt should be set"
  exit 1
fi
echo "PASS: Document verified at $VERIFIED_AT"

echo "E2: Reject document 2 (with reason)..."
REJECT_RESULT=$(api PATCH "/api/people/documents/$DOC2_ID" "{
  \"verificationStatus\": \"rejected\",
  \"rejectionReason\": \"Document is expired, please provide updated version\"
}")
REJECTED_STATUS=$(echo "$REJECT_RESULT" | jq -r '.document.verificationStatus // empty')
if [ "$REJECTED_STATUS" != "rejected" ]; then
  echo "FAIL: Expected status 'rejected', got '$REJECTED_STATUS'"
  echo "$REJECT_RESULT"
  exit 1
fi
REJECTION_REASON=$(echo "$REJECT_RESULT" | jq -r '.document.rejectionReason // empty')
if [ -z "$REJECTION_REASON" ]; then
  echo "FAIL: rejectionReason should be set"
  exit 1
fi
echo "PASS: Document rejected with reason: $REJECTION_REASON"

echo "E3: Attempt reject without reason (should fail)..."
FAIL_REJECT=$(api_raw PATCH "/api/people/documents/$DOC3_ID" "{
  \"verificationStatus\": \"rejected\"
}")
HTTP_STATUS=$(echo "$FAIL_REJECT" | tail -1)
if [ "$HTTP_STATUS" == "400" ]; then
  echo "PASS: Correctly rejected request without rejection reason (HTTP 400)"
else
  echo "FAIL: Expected 400 error for rejection without reason, got $HTTP_STATUS"
  exit 1
fi

echo "E4: Verify document 3..."
VERIFY3_RESULT=$(api PATCH "/api/people/documents/$DOC3_ID" "{
  \"verificationStatus\": \"verified\"
}")
VERIFIED3_STATUS=$(echo "$VERIFY3_RESULT" | jq -r '.document.verificationStatus // empty')
if [ "$VERIFIED3_STATUS" != "verified" ]; then
  echo "FAIL: Expected status 'verified', got '$VERIFIED3_STATUS'"
  exit 1
fi
echo "PASS: Document 3 verified"

# ---- F: Update Document Notes ----
echo ""
echo "=== F: Update Document Notes ==="

echo "F1: Update document notes..."
NOTES_RESULT=$(api PATCH "/api/people/documents/$DOC1_ID" "{
  \"notes\": \"Updated notes for passport document - verified and valid\"
}")
NEW_NOTES=$(echo "$NOTES_RESULT" | jq -r '.document.notes // empty')
if [ -z "$NEW_NOTES" ]; then
  echo "FAIL: Notes should be updated"
  exit 1
fi
echo "PASS: Document notes updated"

# ---- G: Filter by Verification Status ----
echo ""
echo "=== G: Filter by Verification Status ==="

echo "G1: Filter by verified status..."
VERIFIED_DOCS=$(api GET "/api/people/documents?status=verified")
VERIFIED_COUNT=$(echo "$VERIFIED_DOCS" | jq '.items | length')
if [ "$VERIFIED_COUNT" -lt 2 ]; then
  echo "FAIL: Expected at least 2 verified documents"
  exit 1
fi
echo "PASS: Found $VERIFIED_COUNT verified documents"

echo "G2: Filter by rejected status..."
REJECTED_DOCS=$(api GET "/api/people/documents?status=rejected")
REJECTED_COUNT=$(echo "$REJECTED_DOCS" | jq '.items | length')
if [ "$REJECTED_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 rejected document"
  exit 1
fi
echo "PASS: Found $REJECTED_COUNT rejected documents"

# ---- H: Summary ----
echo ""
echo "=== Layer 22 Smoke Test Complete ==="
echo ""
echo "Summary:"
echo "  - Person created: $PERSON_ID"
echo "  - Employee created: $EMPLOYEE_ID"
echo "  - Documents uploaded: 3"
echo "  - Documents verified: 2"
echo "  - Documents rejected: 1"
echo ""
echo "All tests passed successfully!"
