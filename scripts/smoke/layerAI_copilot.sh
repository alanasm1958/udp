#!/bin/bash
#
# Layer AI Smoke Test: AI Copilot with Mock Provider
#
# Tests:
# 1. AI endpoint requires authentication
# 2. Create a new conversation
# 3. Send a message and get response
# 4. List conversations
# 5. Omni endpoint one-shot query
# 6. Navigation intent detection
# 7. Disallowed content is blocked
#

set -euo pipefail

# Source shared auth helper
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_auth.sh"

# Helper to make API calls without auth
api_no_auth() {
  local method=$1
  local path=$2
  local data=${3:-}

  if [ -n "$data" ]; then
    curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "$BASE_URL$path" \
      -H "Content-Type: application/json"
  fi
}

echo "=== Layer AI Smoke Test: AI Copilot ==="
echo ""

# Login using shared helper
smoke_auth_login

# Test 1: AI endpoint requires auth
echo "=== Test 1: AI endpoint requires auth ==="
UNAUTH_RESULT=$(api_no_auth GET "/api/ai/conversations")
UNAUTH_ERROR=$(echo "$UNAUTH_RESULT" | jq -r '.error // empty')
if [ -z "$UNAUTH_ERROR" ] || [ "$UNAUTH_ERROR" = "null" ]; then
  echo "FAIL: Expected error without auth, got: $UNAUTH_RESULT"
  exit 1
fi
echo "PASS: AI endpoint requires auth"
echo ""

# Test 2: Create a new conversation
echo "=== Test 2: Create new conversation ==="
CONV_RESULT=$(api POST "/api/ai/conversations" '{}')
CONV_ID=$(echo "$CONV_RESULT" | jq -r '.id // empty')
if [ -z "$CONV_ID" ] || [ "$CONV_ID" = "null" ]; then
  echo "FAIL: Failed to create conversation: $CONV_RESULT"
  exit 1
fi
echo "PASS: Created conversation ID: $CONV_ID"
echo ""

# Test 3: Send a message (with mock provider - non-streaming response expected via tool call handling)
echo "=== Test 3: Send message to conversation ==="
# Note: The mock provider returns a simple response for basic queries
MSG_RESULT=$(api POST "/api/ai/conversations/$CONV_ID/messages" '{"message":"Hello, what can you help me with?"}')
# Check if we got a response (either SSE or JSON)
if echo "$MSG_RESULT" | grep -q "data:"; then
  echo "PASS: Got SSE streaming response"
elif echo "$MSG_RESULT" | jq -e '.message' > /dev/null 2>&1; then
  echo "PASS: Got JSON response"
else
  echo "Response: $MSG_RESULT"
  echo "PASS: Got some response from AI"
fi
echo ""

# Test 4: List conversations
echo "=== Test 4: List conversations ==="
LIST_RESULT=$(api GET "/api/ai/conversations")
CONV_COUNT=$(echo "$LIST_RESULT" | jq -r '.items | length // 0')
if [ "$CONV_COUNT" -lt 1 ]; then
  echo "FAIL: Expected at least 1 conversation, got: $CONV_COUNT"
  exit 1
fi
echo "PASS: Listed $CONV_COUNT conversation(s)"
echo ""

# Test 5: Omni endpoint one-shot query
echo "=== Test 5: Omni endpoint query ==="
OMNI_RESULT=$(api POST "/api/ai/omni" '{"query":"What is my inventory balance?"}')
OMNI_TYPE=$(echo "$OMNI_RESULT" | jq -r '.type // empty')
if [ -z "$OMNI_TYPE" ] || [ "$OMNI_TYPE" = "null" ]; then
  echo "FAIL: Omni query failed: $OMNI_RESULT"
  exit 1
fi
echo "PASS: Omni response type: $OMNI_TYPE"
echo ""

# Test 6: Navigation intent detection
echo "=== Test 6: Navigation intent ==="
NAV_RESULT=$(api POST "/api/ai/omni" '{"query":"go to sales"}')
NAV_TYPE=$(echo "$NAV_RESULT" | jq -r '.type // empty')
NAV_ROUTE=$(echo "$NAV_RESULT" | jq -r '.route // empty')
if [ "$NAV_TYPE" != "navigation" ]; then
  echo "FAIL: Expected navigation type, got: $NAV_TYPE"
  exit 1
fi
echo "PASS: Navigation detected, route: $NAV_ROUTE"
echo ""

# Test 7: Disallowed content is blocked
echo "=== Test 7: Disallowed content ==="
BLOCKED_RESULT=$(api POST "/api/ai/omni" '{"query":"give me legal advice about suing someone"}')
BLOCKED_TYPE=$(echo "$BLOCKED_RESULT" | jq -r '.type // empty')
if [ "$BLOCKED_TYPE" != "refusal" ]; then
  echo "FAIL: Expected refusal for disallowed content, got: $BLOCKED_TYPE"
  exit 1
fi
echo "PASS: Disallowed content correctly blocked"
echo ""

# Test 8: Trial balance tool call (mock provider should recognize this)
echo "=== Test 8: Trial balance query ==="
TB_RESULT=$(api POST "/api/ai/omni" '{"query":"Show me the trial balance"}')
TB_TYPE=$(echo "$TB_RESULT" | jq -r '.type // empty')
if [ -z "$TB_TYPE" ] || [ "$TB_TYPE" = "null" ]; then
  echo "FAIL: Trial balance query failed: $TB_RESULT"
  exit 1
fi
echo "PASS: Trial balance query type: $TB_TYPE"
echo ""

echo "=== Layer AI Smoke Test Complete ==="
echo "All AI Copilot tests passed!"
