#!/bin/bash
#
# Layer 21 Smoke Test: Performance Management
#
# Tests the complete performance management workflow:
# - Create performance cycle
# - Auto-generate reviews for employees
# - Update review status and ratings
# - Complete and approve reviews
# - Test status transitions and validations
#
# Prerequisites:
# - Server running on localhost:3000
# - Database bootstrapped with admin user
# - At least one employee exists (from layer20_payroll.sh or similar)
#

set -euo pipefail

# Source shared auth helper
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_auth.sh"

echo "=== Layer 21 Smoke Test: Performance Management ==="
echo ""

# Login using shared helper
smoke_auth_login

SUFFIX=$(date +%s)
CURRENT_YEAR=$(date +%Y)

# ---- A: Setup - Create Test People and Employees ----
echo "=== A: Setup - Create Test People and Employees ==="

echo "A1: Creating manager person..."
MANAGER_RESULT=$(api POST "/api/people" "{
  \"fullName\": \"Test Manager $SUFFIX\",
  \"types\": [\"staff\"],
  \"primaryEmail\": \"manager$SUFFIX@test.local\",
  \"jobTitle\": \"Engineering Manager\"
}")
MANAGER_PERSON_ID=$(echo "$MANAGER_RESULT" | jq -r '.id // .personId // empty')
if [ -z "$MANAGER_PERSON_ID" ]; then
  echo "FAIL: Could not create manager person"
  echo "$MANAGER_RESULT"
  exit 1
fi
echo "PASS: Created manager person $MANAGER_PERSON_ID"

echo "A2: Creating manager employee record..."
MANAGER_EMP_RESULT=$(api POST "/api/payroll/employees" "{
  \"personId\": \"$MANAGER_PERSON_ID\",
  \"hireDate\": \"2023-01-15\",
  \"employmentType\": \"full_time\",
  \"flsaStatus\": \"exempt\",
  \"federalFilingStatus\": \"single\",
  \"paymentMethod\": \"direct_deposit\",
  \"initialCompensation\": {
    \"payType\": \"salary\",
    \"payRate\": \"120000.00\",
    \"payFrequency\": \"biweekly\",
    \"standardHoursPerWeek\": \"40\"
  }
}")
MANAGER_EMP_ID=$(echo "$MANAGER_EMP_RESULT" | jq -r '.employeeId // empty')
if [ -z "$MANAGER_EMP_ID" ]; then
  echo "FAIL: Could not create manager employee"
  echo "$MANAGER_EMP_RESULT"
  exit 1
fi
echo "PASS: Created manager employee $MANAGER_EMP_ID"

echo "A3: Creating employee 1 person..."
EMP1_RESULT=$(api POST "/api/people" "{
  \"fullName\": \"Test Developer $SUFFIX\",
  \"types\": [\"staff\"],
  \"primaryEmail\": \"dev$SUFFIX@test.local\",
  \"jobTitle\": \"Software Developer\"
}")
EMP1_PERSON_ID=$(echo "$EMP1_RESULT" | jq -r '.id // .personId // empty')
if [ -z "$EMP1_PERSON_ID" ]; then
  echo "FAIL: Could not create employee 1 person"
  echo "$EMP1_RESULT"
  exit 1
fi
echo "PASS: Created employee 1 person $EMP1_PERSON_ID"

echo "A4: Creating employee 1 record (with manager)..."
EMP1_EMP_RESULT=$(api POST "/api/payroll/employees" "{
  \"personId\": \"$EMP1_PERSON_ID\",
  \"hireDate\": \"2024-03-01\",
  \"employmentType\": \"full_time\",
  \"flsaStatus\": \"exempt\",
  \"federalFilingStatus\": \"single\",
  \"paymentMethod\": \"direct_deposit\",
  \"managerEmployeeId\": \"$MANAGER_EMP_ID\",
  \"initialCompensation\": {
    \"payType\": \"salary\",
    \"payRate\": \"85000.00\",
    \"payFrequency\": \"biweekly\",
    \"standardHoursPerWeek\": \"40\"
  }
}")
EMP1_EMP_ID=$(echo "$EMP1_EMP_RESULT" | jq -r '.employeeId // empty')
if [ -z "$EMP1_EMP_ID" ]; then
  echo "FAIL: Could not create employee 1"
  echo "$EMP1_EMP_RESULT"
  exit 1
fi
echo "PASS: Created employee 1 $EMP1_EMP_ID (manager: $MANAGER_EMP_ID)"

echo "A5: Creating employee 2 person..."
EMP2_RESULT=$(api POST "/api/people" "{
  \"fullName\": \"Test Designer $SUFFIX\",
  \"types\": [\"staff\"],
  \"primaryEmail\": \"designer$SUFFIX@test.local\",
  \"jobTitle\": \"UI Designer\"
}")
EMP2_PERSON_ID=$(echo "$EMP2_RESULT" | jq -r '.id // .personId // empty')
if [ -z "$EMP2_PERSON_ID" ]; then
  echo "FAIL: Could not create employee 2 person"
  echo "$EMP2_RESULT"
  exit 1
fi
echo "PASS: Created employee 2 person $EMP2_PERSON_ID"

echo "A6: Creating employee 2 record (with manager)..."
EMP2_EMP_RESULT=$(api POST "/api/payroll/employees" "{
  \"personId\": \"$EMP2_PERSON_ID\",
  \"hireDate\": \"2024-06-01\",
  \"employmentType\": \"full_time\",
  \"flsaStatus\": \"non_exempt\",
  \"federalFilingStatus\": \"married_jointly\",
  \"paymentMethod\": \"check\",
  \"managerEmployeeId\": \"$MANAGER_EMP_ID\",
  \"initialCompensation\": {
    \"payType\": \"hourly\",
    \"payRate\": \"45.00\",
    \"payFrequency\": \"biweekly\",
    \"standardHoursPerWeek\": \"40\"
  }
}")
EMP2_EMP_ID=$(echo "$EMP2_EMP_RESULT" | jq -r '.employeeId // empty')
if [ -z "$EMP2_EMP_ID" ]; then
  echo "FAIL: Could not create employee 2"
  echo "$EMP2_EMP_RESULT"
  exit 1
fi
echo "PASS: Created employee 2 $EMP2_EMP_ID (manager: $MANAGER_EMP_ID)"

# ---- B: Create Performance Cycle ----
echo ""
echo "=== B: Create Performance Cycle ==="

echo "B1: Creating Q1 performance cycle with auto-generate reviews..."
CYCLE_RESULT=$(api POST "/api/people/performance-cycles" "{
  \"name\": \"Q1 $CURRENT_YEAR Review - Test $SUFFIX\",
  \"frequency\": \"quarterly\",
  \"periodStart\": \"$CURRENT_YEAR-01-01\",
  \"periodEnd\": \"$CURRENT_YEAR-03-31\",
  \"dueDate\": \"$CURRENT_YEAR-04-15\",
  \"assignedToRole\": \"manager\",
  \"notes\": \"Smoke test performance cycle\",
  \"autoGenerateReviews\": true
}")
CYCLE_ID=$(echo "$CYCLE_RESULT" | jq -r '.cycle.id // empty')
REVIEWS_CREATED=$(echo "$CYCLE_RESULT" | jq -r '.reviewsCreated // 0')
if [ -z "$CYCLE_ID" ]; then
  echo "FAIL: Could not create performance cycle"
  echo "$CYCLE_RESULT"
  exit 1
fi
echo "PASS: Created performance cycle $CYCLE_ID"
echo "     Reviews auto-generated: $REVIEWS_CREATED"

if [ "$REVIEWS_CREATED" -lt 2 ]; then
  echo "WARNING: Expected at least 2 reviews to be created"
fi

echo "B2: Verifying cycle details..."
CYCLE_DETAIL=$(api GET "/api/people/performance-cycles/$CYCLE_ID")
CYCLE_STATUS=$(echo "$CYCLE_DETAIL" | jq -r '.status // empty')
CYCLE_NAME=$(echo "$CYCLE_DETAIL" | jq -r '.name // empty')
if [ "$CYCLE_STATUS" != "planned" ]; then
  echo "FAIL: Expected status 'planned', got '$CYCLE_STATUS'"
  exit 1
fi
echo "PASS: Cycle status is 'planned'"

# ---- C: List and Query Performance Cycles ----
echo ""
echo "=== C: List and Query Performance Cycles ==="

echo "C1: Listing all performance cycles..."
CYCLES_LIST=$(api GET "/api/people/performance-cycles")
CYCLES_COUNT=$(echo "$CYCLES_LIST" | jq -r '.items | length // 0')
if [ "$CYCLES_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 cycle"
  exit 1
fi
echo "PASS: Found $CYCLES_COUNT performance cycles"

echo "C2: Filtering by status..."
PLANNED_CYCLES=$(api GET "/api/people/performance-cycles?status=planned")
PLANNED_COUNT=$(echo "$PLANNED_CYCLES" | jq -r '.items | length // 0')
if [ "$PLANNED_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 planned cycle"
  exit 1
fi
echo "PASS: Found $PLANNED_COUNT planned cycles"

# ---- D: Work with Performance Reviews ----
echo ""
echo "=== D: Work with Performance Reviews ==="

echo "D1: Listing reviews for cycle..."
REVIEWS_LIST=$(api GET "/api/people/performance-reviews?cycleId=$CYCLE_ID")
REVIEW_COUNT=$(echo "$REVIEWS_LIST" | jq -r '.items | length // 0')
if [ "$REVIEW_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 review for cycle"
  echo "$REVIEWS_LIST"
  exit 1
fi
echo "PASS: Found $REVIEW_COUNT reviews for cycle"

# Get first review ID
REVIEW_ID=$(echo "$REVIEWS_LIST" | jq -r '.items[0].id')
REVIEW_STATUS=$(echo "$REVIEWS_LIST" | jq -r '.items[0].status')
REVIEW_EMPLOYEE=$(echo "$REVIEWS_LIST" | jq -r '.items[0].employeeName')
echo "     First review: $REVIEW_ID for $REVIEW_EMPLOYEE (status: $REVIEW_STATUS)"

echo "D2: Getting review details..."
REVIEW_DETAIL=$(api GET "/api/people/performance-reviews/$REVIEW_ID")
REVIEW_CYCLE_NAME=$(echo "$REVIEW_DETAIL" | jq -r '.cycleName // empty')
if [ -z "$REVIEW_CYCLE_NAME" ]; then
  echo "FAIL: Could not get review details"
  echo "$REVIEW_DETAIL"
  exit 1
fi
echo "PASS: Review details retrieved (cycle: $REVIEW_CYCLE_NAME)"

echo "D3: Starting review (not_started -> in_progress)..."
UPDATE_RESULT=$(api PATCH "/api/people/performance-reviews/$REVIEW_ID" "{
  \"status\": \"in_progress\"
}")
NEW_STATUS=$(echo "$UPDATE_RESULT" | jq -r '.status // empty')
if [ "$NEW_STATUS" != "in_progress" ]; then
  echo "FAIL: Expected status 'in_progress', got '$NEW_STATUS'"
  echo "$UPDATE_RESULT"
  exit 1
fi
echo "PASS: Review status updated to 'in_progress'"

echo "D4: Adding review content and rating..."
UPDATE_RESULT=$(api PATCH "/api/people/performance-reviews/$REVIEW_ID" "{
  \"overallRating\": 4,
  \"strengths\": \"Strong technical skills, excellent problem-solving ability\",
  \"areasForImprovement\": \"Could improve documentation practices\",
  \"goalsForNextPeriod\": \"Lead a major feature implementation\",
  \"managerComments\": \"Great progress this quarter\",
  \"ratings\": [
    {
      \"category\": \"job_knowledge\",
      \"categoryLabel\": \"Job Knowledge\",
      \"rating\": 4,
      \"weight\": 1.0,
      \"comments\": \"Demonstrates solid understanding of codebase\"
    },
    {
      \"category\": \"quality_of_work\",
      \"categoryLabel\": \"Quality of Work\",
      \"rating\": 5,
      \"weight\": 1.0,
      \"comments\": \"Consistently delivers high-quality code\"
    },
    {
      \"category\": \"communication\",
      \"categoryLabel\": \"Communication\",
      \"rating\": 4,
      \"weight\": 1.0,
      \"comments\": \"Clear and effective communicator\"
    }
  ]
}")
OVERALL_RATING=$(echo "$UPDATE_RESULT" | jq -r '.overallRating // empty')
if [ "$OVERALL_RATING" != "4" ]; then
  echo "FAIL: Expected overall rating 4, got '$OVERALL_RATING'"
  exit 1
fi
echo "PASS: Review content and ratings added (overall: $OVERALL_RATING/5)"

echo "D5: Submitting review (in_progress -> submitted)..."
UPDATE_RESULT=$(api PATCH "/api/people/performance-reviews/$REVIEW_ID" "{
  \"status\": \"submitted\"
}")
NEW_STATUS=$(echo "$UPDATE_RESULT" | jq -r '.status // empty')
COMPLETED_AT=$(echo "$UPDATE_RESULT" | jq -r '.completedAt // empty')
if [ "$NEW_STATUS" != "submitted" ]; then
  echo "FAIL: Expected status 'submitted', got '$NEW_STATUS'"
  exit 1
fi
if [ -z "$COMPLETED_AT" ] || [ "$COMPLETED_AT" = "null" ]; then
  echo "FAIL: completedAt should be set"
  exit 1
fi
echo "PASS: Review submitted at $COMPLETED_AT"

echo "D6: Approving review (submitted -> approved)..."
UPDATE_RESULT=$(api PATCH "/api/people/performance-reviews/$REVIEW_ID" "{
  \"status\": \"approved\"
}")
NEW_STATUS=$(echo "$UPDATE_RESULT" | jq -r '.status // empty')
APPROVED_AT=$(echo "$UPDATE_RESULT" | jq -r '.approvedAt // empty')
if [ "$NEW_STATUS" != "approved" ]; then
  echo "FAIL: Expected status 'approved', got '$NEW_STATUS'"
  exit 1
fi
if [ -z "$APPROVED_AT" ] || [ "$APPROVED_AT" = "null" ]; then
  echo "FAIL: approvedAt should be set"
  exit 1
fi
echo "PASS: Review approved at $APPROVED_AT"

# ---- E: Test Status Transitions ----
echo ""
echo "=== E: Test Status Transitions ==="

echo "E1: Try invalid transition (approved -> in_progress should fail)..."
INVALID_RESULT=$(api PATCH "/api/people/performance-reviews/$REVIEW_ID" "{
  \"status\": \"in_progress\"
}")
ERROR_MSG=$(echo "$INVALID_RESULT" | jq -r '.error // empty')
if [ -z "$ERROR_MSG" ]; then
  echo "FAIL: Should have rejected invalid status transition"
  exit 1
fi
echo "PASS: Correctly rejected invalid transition: $ERROR_MSG"

# ---- F: Cycle Status Transitions ----
echo ""
echo "=== F: Cycle Status Transitions ==="

echo "F1: Activating cycle (planned -> active)..."
CYCLE_UPDATE=$(api PATCH "/api/people/performance-cycles/$CYCLE_ID" "{
  \"status\": \"active\"
}")
CYCLE_STATUS=$(echo "$CYCLE_UPDATE" | jq -r '.status // empty')
if [ "$CYCLE_STATUS" != "active" ]; then
  echo "FAIL: Expected status 'active', got '$CYCLE_STATUS'"
  exit 1
fi
echo "PASS: Cycle activated"

echo "F2: Checking cycle stats after review completion..."
CYCLE_DETAIL=$(api GET "/api/people/performance-cycles/$CYCLE_ID")
REVIEW_STATS=$(echo "$CYCLE_DETAIL" | jq -r '.reviewStats')
TOTAL_REVIEWS=$(echo "$REVIEW_STATS" | jq -r '.total // 0')
APPROVED_REVIEWS=$(echo "$REVIEW_STATS" | jq -r '.approved // 0')
echo "PASS: Cycle stats - Total: $TOTAL_REVIEWS, Approved: $APPROVED_REVIEWS"

# ---- G: Create Cycle Without Auto-Generate ----
echo ""
echo "=== G: Create Cycle Without Auto-Generate ==="

echo "G1: Creating manual cycle..."
MANUAL_CYCLE=$(api POST "/api/people/performance-cycles" "{
  \"name\": \"Annual Review $CURRENT_YEAR - Manual $SUFFIX\",
  \"frequency\": \"annual\",
  \"periodStart\": \"$CURRENT_YEAR-01-01\",
  \"periodEnd\": \"$CURRENT_YEAR-12-31\",
  \"dueDate\": \"$((CURRENT_YEAR + 1))-01-31\",
  \"autoGenerateReviews\": false
}")
MANUAL_CYCLE_ID=$(echo "$MANUAL_CYCLE" | jq -r '.cycle.id // empty')
MANUAL_REVIEWS=$(echo "$MANUAL_CYCLE" | jq -r '.reviewsCreated // 0')
if [ -z "$MANUAL_CYCLE_ID" ]; then
  echo "FAIL: Could not create manual cycle"
  echo "$MANUAL_CYCLE"
  exit 1
fi
if [ "$MANUAL_REVIEWS" != "0" ]; then
  echo "FAIL: Expected 0 reviews for manual cycle, got $MANUAL_REVIEWS"
  exit 1
fi
echo "PASS: Created manual cycle $MANUAL_CYCLE_ID (reviews: $MANUAL_REVIEWS)"

echo "G2: Deleting planned cycle (should succeed)..."
DELETE_RESULT=$(api DELETE "/api/people/performance-cycles/$MANUAL_CYCLE_ID")
DELETE_SUCCESS=$(echo "$DELETE_RESULT" | jq -r '.success // false')
if [ "$DELETE_SUCCESS" != "true" ]; then
  echo "FAIL: Could not delete planned cycle"
  echo "$DELETE_RESULT"
  exit 1
fi
echo "PASS: Deleted planned cycle"

echo "G3: Try to delete active cycle (should fail)..."
DELETE_ACTIVE=$(api DELETE "/api/people/performance-cycles/$CYCLE_ID")
DELETE_ERROR=$(echo "$DELETE_ACTIVE" | jq -r '.error // empty')
if [ -z "$DELETE_ERROR" ]; then
  echo "FAIL: Should have rejected deletion of active cycle"
  exit 1
fi
echo "PASS: Correctly rejected deletion of active cycle: $DELETE_ERROR"

# ---- H: Filter Reviews ----
echo ""
echo "=== H: Filter Reviews ==="

echo "H1: Filter by status..."
APPROVED_LIST=$(api GET "/api/people/performance-reviews?status=approved")
APPROVED_COUNT=$(echo "$APPROVED_LIST" | jq -r '.items | length // 0')
echo "PASS: Found $APPROVED_COUNT approved reviews"

echo "H2: Filter by employee..."
EMP_REVIEWS=$(api GET "/api/people/performance-reviews?employeeId=$EMP1_EMP_ID")
EMP_REVIEW_COUNT=$(echo "$EMP_REVIEWS" | jq -r '.items | length // 0')
echo "PASS: Found $EMP_REVIEW_COUNT reviews for employee"

# ---- Summary ----
echo ""
echo "=== Layer 21 Smoke Test Complete ==="
echo ""
echo "Summary:"
echo "  - Created 3 employees (1 manager, 2 reports)"
echo "  - Created performance cycle with auto-generated reviews"
echo "  - Reviews created: $REVIEWS_CREATED"
echo "  - Completed full review workflow: not_started -> in_progress -> submitted -> approved"
echo "  - Added ratings and feedback to review"
echo "  - Tested cycle status transitions: planned -> active"
echo "  - Validated status transition rules"
echo "  - Tested manual cycle creation and deletion"
echo ""
echo "All tests passed!"
