# Smoke Test Report (2025-12-25)

## Environment Status
- Docker: ✅ Running
- PostgreSQL: ✅ Connected (127.0.0.1:5432)
- Migrations: ✅ Applied
- Dev Server: ✅ Running (port 3000)
- guard:all: ✅ Passed (64 tables)
- lint: ✅ Passed
- build: ✅ Passed

## IDs Created/Used
- TENANT_ID: 21106d5d-71bb-4a2a-a0d8-1ea698d37989
- USER_ID: 2aaf5a1d-cd8d-4b36-8fcb-0f59c70ef7b4
- PRODUCT_ID: 612086bf-63e7-4123-97f5-ef02291425c9
- WAREHOUSE_ID: 15b071a8-9a64-4ac8-bc8f-75422efee60b
- CUSTOMER_ID: fe11f0ff-0957-4193-8184-8835cb983b92
- VENDOR_ID: 52d395be-6898-4eec-b645-90e1dd0dccb7
- SALES_DOC_ID: db0c2a06-b738-492d-95ec-7374d868417a
- PO_ID: de9c7a2e-8d60-4402-b7bd-6883e8471435
- PINV_ID: 8a159e30-06ca-4512-af7a-0f5488a184ff
- PAYMENT_ID: aaad29b8-5ebb-4272-aa32-59a5dc0f072c

## Test Results Summary
- Master Data (Products, Warehouses, Parties): ✅ PASS
- Inventory Receipts + Posting: ✅ PASS
- Sales Invoice + Lines: ✅ PASS
- Sales Fulfillment (Reserve + Ship): ✅ PASS
- Procurement PO + Receiving: ✅ PASS
- Accounting Posting (Sales + Purchase): ✅ PASS
- Payments + Allocations + Posting: ✅ PASS

## Key Verifications
- Inventory Balances: Final on_hand=125, reserved=2, available=123 ✅
- Sales Posting: Dr AR 1100, Cr Revenue 4000, Dr COGS 5100, Cr Inventory 1400 ✅
- Purchase Posting: Dr Inventory 1400, Cr AP 2000 ✅
- Payment Posting: Dr Cash 1000 (uses payment.cashAccountCode), Cr AR 1100 ✅
- Idempotency: Re-post returns same journal entry ✅

## Fixes Applied
- None required

## Recommended Hardening Steps
1. Integration tests: payment over-allocation (allocation > payment.amount)
2. Prevent posting payments to already-paid invoices (track open AR/AP)
3. Bank reconciliation workflow
4. Multi-currency payments + FX rates
5. Void/reversal workflow for payments
