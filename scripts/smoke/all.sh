#!/bin/bash
#
# Master Smoke Test Script
#
# Runs all guards, lint, build, and smoke tests in order.
# Fails fast on any error.
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=========================================="
echo "  UDP Master Smoke Test Suite"
echo "=========================================="
echo ""

# Track start time
START_TIME=$(date +%s)

# Function to report elapsed time
elapsed() {
  local END_TIME=$(date +%s)
  local ELAPSED=$((END_TIME - START_TIME))
  echo "Elapsed time: ${ELAPSED}s"
}

# Ensure we're in the project directory
cd "$PROJECT_DIR"

# --- Phase 1: Static Analysis ---
echo "=== Phase 1: Static Analysis ==="
echo ""

echo ">>> Running guard:all..."
npm run guard:all
echo "PASS: guard:all"
echo ""

echo ">>> Running lint..."
npm run lint
echo "PASS: lint"
echo ""

# --- Phase 2: Build ---
echo "=== Phase 2: Build ==="
echo ""

echo ">>> Running production build..."
npm run build
echo "PASS: build"
echo ""

# --- Phase 3: Smoke Tests ---
echo "=== Phase 3: Smoke Tests ==="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000/api/auth/bootstrap -o /dev/null 2>&1; then
  echo "ERROR: Server not running on localhost:3000"
  echo "Start the dev server with: npm run dev"
  exit 1
fi
echo "Server is running"
echo ""

echo ">>> Running layer16_tenant_rbac.sh..."
bash "$SCRIPT_DIR/layer16_tenant_rbac.sh"
echo ""

echo ">>> Running layer11_ar_ap.sh..."
bash "$SCRIPT_DIR/layer11_ar_ap.sh"
echo ""

echo ">>> Running layer12_2_unallocate.sh..."
bash "$SCRIPT_DIR/layer12_2_unallocate.sh"
echo ""

echo ">>> Running layerAI_copilot.sh..."
bash "$SCRIPT_DIR/layerAI_copilot.sh"
echo ""

echo ">>> Running layer_subscriptions.sh..."
bash "$SCRIPT_DIR/layer_subscriptions.sh"
echo ""

# --- Summary ---
echo "=========================================="
echo "  All Smoke Tests Passed!"
echo "=========================================="
elapsed
