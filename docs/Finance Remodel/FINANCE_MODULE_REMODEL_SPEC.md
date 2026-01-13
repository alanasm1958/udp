# Finance Module - Remodel Specification

## Overview

This is a **remodel specification** for the Finance module within the UDP ERP system. The Finance module maintains full double-entry accrual accounting integrity while presenting an SME-accessible interface using business-outcome language.

## Design Philosophy

**Core Principle**: Full double-entry accrual accounting integrity under the hood, but presented through business-outcome language and visual metaphors that SME owners understand intuitively.

**Integration Flow**: 
- Expenses from Operations module automatically flow here as financial transactions
- Income from Sales module automatically flows here as revenue transactions
- All transactions arrive in "Ready to Post" status for review and finalization

**Key Insight**: SME owners think in terms of:
- "Do I have money to pay bills?"
- "Who owes me money?"
- "Who do I owe money to?"
- "Am I making money or losing money?"
- "Can I afford to hire/buy/invest?"

They don't think in terms of debits, credits, or journal entries - but the system still needs to maintain those correctly.

## Module Structure

The Finance module follows the standard three-tier layout:
1. **Top**: Analytics cards (financial health metrics)
2. **Middle**: Todos (left panel) and Alerts (right panel)
3. **Bottom**: Quick access navigation cards

---

## 1. Analytics Section (Top Cards)

### Row 1: Cash Reality - "What money do I actually have?"

**💰 Money in Bank** 
- Shows total cash across all bank accounts
- Visual: Large number with bank icon
- Tooltip: "This is the actual money you have available right now in your bank accounts"
- Trend: 7-day and 30-day change
- Click: Drills into bank account details
- Color coding: Green (healthy), Yellow (below 1 month operating), Red (critical)

**📊 Cash Runway**
- Shows months of operation you can afford
- Visual: "You can run for X months at current spending"
- Tooltip: "Based on your current cash and average monthly spending, this is how long you can operate"
- Calculation: Current cash / Average monthly burn
- SME-friendly: Uses simple language like "runway" (borrowed from startup terminology)

**💸 This Month's Money Flow**
- Net change in cash this month (in/out)
- Visual: Arrow up (money coming in) or down (money going out)
- Breakdown on hover: "Money received: $X, Money paid: $Y"
- Tooltip: "This shows whether you're collecting more than you're spending this month"

### Row 2: Money Owed - "Who owes who?"

**🧾 Customers Owe You**
- Total AR with aging visual (pie chart: Current, 1-30, 31-60, 60+)
- Label: "Money your customers owe you"
- Tooltip: "These are unpaid invoices. The colors show how long they've been waiting - green is recent, red needs attention"
- Quick view: Top 3 overdue customers
- Click: Opens AR dashboard

**📋 You Owe Vendors**
- Total AP with aging visual
- Label: "Money you owe to vendors"
- Tooltip: "These are bills you need to pay. Red means they're overdue or due soon"
- Quick view: Next 3 payments due
- Click: Opens AP dashboard

**⚖️ Net Position**
- AR minus AP = Net
- Visual: "Overall, customers owe you $X more than you owe vendors" or vice versa
- Tooltip: "This is the difference between what people owe you and what you owe others"

### Row 3: Business Performance - "Am I making money?"

**📈 This Month's Sales**
- Total revenue recognized this month (accrual basis)
- Label: "Sales This Month"
- Comparison: vs last month, vs same month last year
- Visual: Clear up/down indicator
- Tooltip: "This is all the work you've done or products you've sold this month, even if customers haven't paid yet"
- **Critical for SME**: "Note: This includes invoices you've sent but haven't been paid. See 'Money in Bank' for actual cash received."

**📉 This Month's Expenses**
- Total expenses recognized this month
- Label: "Costs & Expenses This Month"
- Breakdown on hover: Payroll, Vendors, Operations, etc.
- Tooltip: "Everything it cost to run your business this month, even if you haven't paid the bills yet"

**💚 Profit This Month**
- Revenue minus Expenses = Profit (or Loss)
- Visual: Large number with clear color coding (Green profit, Red loss)
- Label: "Profit (or Loss) This Month"
- Percentage: Profit margin %
- Tooltip: "This is whether you made money this month. It includes all sales and costs, regardless of whether money actually moved yet."
- **Critical explanation**: "This is 'accrual' accounting - it shows your true business performance even though some money hasn't been paid yet."

---

## 2. Todos & Alerts Section (Middle)

### Left Panel: Things You Need to Do (Todos)

**Design Principle**: Every todo is action-oriented and explains WHY it matters in business terms.

#### 🔴 Urgent (Due Today or Overdue)

**Bills Due Today**
- "Pay 3 bills totaling $5,240 - they're due today"
- Visual: Red badge, vendor names visible
- Click: Opens payment entry drawer pre-filled
- Why it matters: "Paying on time protects your vendor relationships and credit"

**Overdue Customer Invoices**
- "3 customers owe you $12,300 and are over 30 days late"
- Visual: Customer names, days overdue
- Click: Opens email/reminder drawer
- Why it matters: "The longer invoices wait, the harder they are to collect"

**Unfinished Transactions**
- "5 drafts ready to finalize (2 invoices, 3 expense reports)"
- Visual: Document type icons
- Click: Opens respective entry drawer
- Why it matters: "These transactions aren't in your books yet - finish them to see accurate numbers"

#### 🟡 Important (This Week)

**Bills Due This Week**
- "7 bills totaling $18,500 due in the next 7 days"
- Visual: Due dates visible
- Click: Opens payment planning view
- Why it matters: "Plan ahead to ensure you have cash available"

**Follow-up Required**
- "2 customers haven't responded to payment reminders"
- Visual: Customer names, original invoice dates
- Click: Opens escalation options
- Why it matters: "Some customers just need a phone call"

**Month-End Tasks**
- "Close last month's books (3 tasks remaining)"
- Visual: Checklist with completion status
- Click: Opens month-end wizard
- Why it matters: "Closing the month locks in your numbers for accurate reporting"

#### 🔵 Routine (Keep Things Clean)

**Bank Transactions to Match**
- "15 bank transactions need to be matched to your records"
- Visual: Count and total amount
- Click: Opens reconciliation drawer
- Why it matters: "This ensures your bank balance matches what your system shows"

**Unallocated Payments**
- "Customer payment of $5,000 received but not applied to invoices"
- Visual: Payment details
- Click: Opens allocation drawer
- Why it matters: "Apply payments to invoices so you know what's still owed"

**Review & Approve**
- "2 expense reports waiting for your approval ($1,240)"
- Visual: Submitter names, amounts
- Click: Opens approval interface
- Why it matters: "Approve expenses so they show in your numbers and can be paid"

### Right Panel: System Alerts (Things You Should Know)

**Design Principle**: Alerts explain problems in business impact terms, not technical terms.

#### 🔴 Critical Alerts

**Low Cash Warning**
- "Your bank balance is below your safety threshold"
- Visual: Current balance, threshold, shortfall
- Impact: "You might not have enough to cover upcoming bills"
- Action: "Review upcoming payments" or "Delay non-critical spending"
- Dismiss: Snooze for X days with reason

**Customer Over Credit Limit**
- "ABC Corp has ordered $15,000 but their limit is $10,000"
- Impact: "They already owe you $8,000 - total exposure would be $23,000"
- Action: "Request payment before delivery" or "Increase credit limit"
- Why it matters: "Credit limits protect you from customers who can't pay"

**Duplicate Payment Warning**
- "You might be paying the same bill twice (Invoice #12345)"
- Visual: Both payment records
- Impact: "This could waste $2,500"
- Action: "Review and confirm" or "Cancel second payment"

#### 🟡 Warning Alerts

**Aged Receivables**
- "3 invoices are over 90 days old ($8,500)"
- Impact: "Old invoices are rarely collected in full"
- Action: "Contact customers" or "Consider write-off"
- Why it matters: "Don't count on money that's very late"

**Budget Overrun**
- "Marketing expenses are 45% over budget this month"
- Visual: Budget vs actual comparison
- Impact: "You're spending more than planned"
- Action: "Review spending" or "Adjust budget"

**Missing Documentation**
- "5 expenses have no receipt attached"
- Impact: "You might not be able to claim these for taxes"
- Action: "Upload receipts"
- Why it matters: "Tax authorities require proof of expenses"

**Stale Bank Balance**
- "Bank connection hasn't synced in 5 days"
- Impact: "Your cash position might be wrong"
- Action: "Reconnect bank" or "Enter transactions manually"

#### 🔵 Info Alerts

**Upcoming Deadline**
- "Sales tax filing due in 15 days"
- Action: "Generate report" or "Mark as handled elsewhere"
- Why it matters: "Missing tax deadlines means penalties"

**Seasonal Pattern Detected**
- "Your November expenses are typically 40% higher"
- Impact: "Plan for $12,000 extra spending this month"
- Action: "Review forecast"
- Why it matters: "AI noticed a pattern to help you plan"

---

## 3. Quick Access Section (Bottom) - "What Can I Do Here?"

### Primary Action Button (Single Entry Point)

**🎯 Record Financial Activity** - Large, prominent button
- Opens: Financial Activity Drawer
- This is the ONLY entry point for all financial transactions
- Icon: Circular button with "+" or money icon
- Color: Primary brand color with glass morphism effect
- Position: Top-right of quick access section

### Navigation Cards (Read-Only Views)

These cards lead to data tables and reports, NOT transaction entry forms:

#### Row 1: Document Views

**💰 Invoices (Sales)**
- Route: `/finance/invoices`
- Shows: Data table of all sales invoices
- Filters: Status, customer, date range
- Columns: Doc number, customer, date, amount, status, due date
- Actions per row: View details (read-only), download PDF, send reminder
- No "Create" button - use "Record Financial Activity" instead

**📋 Bills (Purchase)**
- Route: `/finance/bills`
- Shows: Data table of all purchase invoices/bills
- Filters: Status, vendor, date range
- Columns: Doc number, vendor, date, amount, status, due date
- Actions per row: View details, download PDF, schedule payment
- No "Create" button - use "Record Financial Activity" instead

**💸 Payments**
- Route: `/finance/payments`
- Shows: Data table of all payments (receipts and disbursements)
- Filters: Type (receipt/payment), status, date range, payment method
- Columns: Payment ID, type, party, amount, date, method, status, allocated
- Actions per row: View details, view allocation, download receipt
- No "Create" button - use "Record Financial Activity" instead

**📝 Journal Entries**
- Route: `/finance/journals`
- Shows: Data table of all journal entries
- Filters: Status, date range, source type
- Columns: Entry ID, date, description, total debit, total credit, status
- Actions per row: View lines (read-only), view source transaction
- Note: Manual journal entries also created via "Record Financial Activity"

#### Row 2: Account Views

**📊 Chart of Accounts**
- Route: `/finance/coa`
- Shows: Tree structure of all accounts
- Displays: Account code, name, type, balance, status
- Actions: View account ledger, edit account details (name, description only)
- Note: Cannot delete accounts with transactions, only deactivate

**📖 General Ledger**
- Route: `/finance/general-ledger`
- Shows: Detailed transaction history by account
- Filters: Date range, account, transaction type
- Columns: Date, description, reference, debit, credit, balance
- Actions: Drill down to source document

**⚖️ Trial Balance**
- Route: `/finance/trial-balance`
- Shows: Account balances report (debits = credits)
- Parameters: As of date, account level
- Display: Account, debit balance, credit balance, totals
- Export: PDF, Excel

**🏦 Bank Reconciliation**
- Route: `/finance/bank-reconciliation`
- Shows: List of bank accounts and reconciliation status
- Displays: Account, last reconciled date, unreconciled items count
- Action: Open reconciliation drawer for selected account

#### Row 3: Analysis & Reports

**💵 Cash Flow**
- Route: `/finance/reports/cashflow`
- Shows: Cash flow statement
- Parameters: Period (month, quarter, year)
- Categories: Operating, investing, financing activities
- Visual: Waterfall chart
- Export: PDF, Excel

**📈 Profit & Loss**
- Route: `/finance/reports/pl`
- Shows: Income statement
- Parameters: Period, comparison periods
- Displays: Revenue, expenses, net profit/loss
- Visual: Trend charts
- Export: PDF, Excel

**📊 Balance Sheet**
- Route: `/finance/reports/bs`
- Shows: Balance sheet (assets = liabilities + equity)
- Parameters: As of date
- Categories: Current/non-current assets, liabilities, equity
- Visual: Composition charts
- Export: PDF, Excel

**📅 AR Aging**
- Route: `/finance/ar-aging`
- Shows: Receivables aging report
- Buckets: Current, 1-30, 31-60, 61-90, 90+ days
- Displays: By customer with totals
- Actions: Send reminder, view invoices
- Export: PDF, Excel

**📅 AP Aging**
- Route: `/finance/ap-aging`
- Shows: Payables aging report
- Buckets: Current, 1-30, 31-60, 61-90, 90+ days
- Displays: By vendor with totals
- Actions: Schedule payment, view bills
- Export: PDF, Excel

**🎯 Budget vs Actual**
- Route: `/finance/budget-analysis`
- Shows: Budget variance analysis
- Parameters: Budget, period, department/dimension
- Displays: Budget, actual, variance ($, %), status
- Visual: Variance bars (green/red)
- Export: PDF, Excel

#### Row 4: Setup (Settings Gear Icon)

**⚙️ Financial Settings**
- Route: `/finance/settings`
- Configure: Fiscal year start, default currency, rounding rules
- Permissions: Admin only

**💼 Tax Configuration**
- Route: `/finance/tax-config`
- Setup: Tax rates, categories, jurisdictions
- Displays: Tax rate table
- Actions: Add/edit tax rates

**🔐 Period Management**
- Route: `/finance/periods`
- Shows: Fiscal periods with status (open/closed)
- Actions: Close period (with guided wizard)
- Note: Cannot post to closed periods

**👥 Approval Workflows**
- Route: `/finance/approvals`
- Configure: Approval rules by amount, document type
- Setup: Approval chains, delegates
- Permissions: Admin only

---

## 4. Unified Entry Drawers (Single Point of Entry)

### Payment Entry Drawer (Replaces multiple payment entry points)

**Header**: "Record a Payment"

**Step 1: What kind of payment?**
- Radio buttons with icons:
  - 💰 "Money Received (from customer)"
  - 💸 "Money Paid (to vendor/supplier)"
  - 🔄 "Transfer Between Accounts"

**Step 2: Who? (Conditional on type)**
- Searchable dropdown: Customers (if receipt) or Vendors (if payment)
- Quick add: "+ Add new customer/vendor"

**Step 3: How much and when?**
- Amount: Large input field with currency
- Date: Date picker (defaults to today)
- Reference: Check number, transaction ID, etc.

**Step 4: Payment method**
- Dropdown: Cash, Bank Transfer, Check, Credit Card, PayPal, Other
- Bank account: (if bank transfer) Select from connected accounts

**Step 5: What is this for? (Smart matching)**
- If customer: Shows open invoices with suggested allocation
  - Visual: Invoice list with checkboxes and amounts
  - Auto-suggest: "This customer owes $5,000 on Invoice #123 - apply to this?"
  - Partial: Allow partial allocation
- If vendor: Shows open bills
- If neither: "What account category is this?"

**Step 6: Review**
- Summary of what will be recorded:
  - "You received $5,000 from ABC Corp on Jan 15"
  - "This payment will be applied to Invoice #123"
  - "Your books will show: Money in bank increased, Customer owes you less"
- "Behind the scenes": Expandable section showing the journal entry (for power users)

**Actions**:
- "Record & Done" (posts immediately)
- "Save as Draft" (for review later)
- "Record & Create Another"

**Post-Success**:
- Toast: "✓ Payment recorded!"
- Show updated balances
- Option to print receipt

### Expense Entry Drawer (Quick & Smart)

**Header**: "Record a Business Expense"

**Step 1: How much?**
- Amount: Large input field
- Date: Date picker

**Step 2: What was it for?**
- Description: Free text field
- AI suggestion: "Looks like office supplies - is this correct?"

**Step 3: Category**
- Smart dropdown: Pre-categorized based on description
- Common categories at top: Meals, Fuel, Supplies, Software, etc.
- Full list: Available on expand

**Step 4: Receipt** (Optional but encouraged)
- Upload: Drag-drop or camera
- OCR: Auto-extract amount and vendor (verify)
- Tooltip: "Receipts help with taxes and audits"

**Step 5: Who paid?** (For reimbursement tracking)
- Radio: Company paid / Employee paid (needs reimbursement)
- If employee: Select employee from dropdown

**Step 6: Add to project?** (Optional)
- Checkbox: "This expense is for a specific project/customer"
- If yes: Select project/customer for cost tracking

**Behind the Scenes** (Automatic):
- Creates journal entry: DR Expense account, CR Cash/Payable
- Links to dimensions (project/department)
- Triggers approval workflow if over threshold
- Notifies manager if reimbursement needed

**Review**:
- "This $45 meal expense will be recorded in your books"
- "It will show in this month's profit/loss"
- If not paid yet: "We'll track that you need to reimburse yourself $45"

### Invoice Creation Drawer (Wizard-based)

**Header**: "Create an Invoice"

**Step 1: Who are you billing?**
- Customer: Searchable dropdown
- Quick add: "+ Add new customer"
- Load: Customer's payment terms and history

**Step 2: What are you charging for?**
- Line items:
  - Description: Free text or select from products/services
  - Quantity: Number
  - Price: Per unit price
  - Total: Auto-calculated
- Add line: "+ Add another line"
- Smart suggestions: "You usually charge ABC Corp for consulting at $150/hr"

**Step 3: Invoice details**
- Invoice date: Date picker (defaults to today)
- Due date: Auto-calculated from payment terms
- Invoice number: Auto-generated (editable)
- Reference: PO number, project code, etc.

**Step 4: Terms & Notes**
- Payment terms: Dropdown (Net 30, Net 15, Due on Receipt)
- Notes: Additional instructions
- Attachments: Supporting documents

**Step 5: Review**
- Preview: What customer will see
- Summary:
  - "You're billing ABC Corp for $5,000"
  - "They should pay by [due date]"
  - "This will show as 'Sales' in your books"
  - "They'll owe you $5,000 until they pay"

**Actions**:
- "Create & Send" (creates invoice and emails)
- "Create & Download" (creates and downloads PDF)
- "Save as Draft" (for review later)

**Behind the Scenes**:
- Creates sales document
- Posts to ledger: DR Accounts Receivable, CR Revenue
- Updates customer balance
- Triggers dunning workflow on due date

### Bill Entry Drawer (From vendor)

**Header**: "Enter a Bill"

**Step 1: Upload bill** (Optional but recommended)
- Upload: PDF, image
- OCR: Extract vendor, amount, date, line items
- Review: "We detected these details - please verify"

**Step 2: Who sent this bill?**
- Vendor: Searchable dropdown
- Quick add: "+ Add new vendor"
- Load: Vendor's terms and history

**Step 3: Bill details**
- Bill date: Date picker
- Due date: Auto-calculated or manual
- Bill number: Vendor's invoice number
- Amount: Total amount (if not OCR'd)

**Step 4: What is this bill for?**
- Line items (if detailed tracking needed):
  - Category: Expense account dropdown
  - Description: Free text
  - Amount: Line amount
- Or single line: "Just categorize the whole bill"

**Step 5: Payment plan**
- Radio buttons:
  - "Pay immediately" → Opens payment drawer
  - "Schedule for [due date]" → Adds to payment queue
  - "I'll decide later" → Just records the bill

**Review**:
- "This $2,500 bill from ABC Supplies will be recorded"
- "It will show in this month's expenses"
- "You'll owe ABC Supplies $2,500 until you pay"
- Due date reminder: "Payment due [date]"

**Behind the Scenes**:
- Creates purchase document
- Posts to ledger: DR Expense, CR Accounts Payable
- Updates vendor balance
- Schedules payment reminder

### Bank Reconciliation Drawer

**Header**: "Reconcile Bank Account"

**Step 1: Select account**
- Dropdown: Bank accounts
- Show: Last reconciliation date and balance

**Step 2: Enter statement ending**
- Ending balance: From bank statement
- Ending date: Statement date

**Step 3: Match transactions**
- Two columns:
  - Left: Bank statement transactions
  - Right: Your recorded transactions
- Visual: Drag-and-drop to match
- Auto-match: System suggests matches
- Status indicators:
  - ✓ Matched (green)
  - ? Suggested match (yellow)
  - ✗ Unmatched (red)

**Step 4: Resolve differences**
- Unmatched bank items:
  - Action: "Record this transaction" → Opens entry drawer
  - Or: "This is a bank fee/interest" → Quick categorize
- Unmatched book items:
  - Action: "This hasn't cleared yet" → Mark as outstanding
  - Or: "This was recorded wrong" → Edit

**Step 5: Verify**
- Summary:
  - "Bank statement balance: $15,240"
  - "Your books balance: $15,240"
  - "Difference: $0 ✓"
- If difference: "You have a $X difference that needs resolution"

**Complete**:
- "Lock this reconciliation" → Prevents changes to matched items
- Generate reconciliation report

---

## 5. Educational Overlays & Helpers

### First-Time User Experience

**Welcome Wizard**: "Let's Set Up Your Financial System"

**Step 1: Tell us about your business**
- Do you send invoices to customers? (Yes/No)
- Do you buy from vendors? (Yes/No)
- Do you have employees? (Yes/No)
- Do you track inventory? (Yes/No)

**Step 2: Connect your bank** (Optional but recommended)
- Why: "This automatically imports transactions"
- Security: "We use bank-level encryption"
- Manual option: "I'll enter transactions manually"

**Step 3: Starting balances**
- "How much is in your bank account today?"
- "Do customers owe you money?" → Import open invoices
- "Do you owe vendors money?" → Import open bills

**Step 4: Basic setup**
- Fiscal year start
- Default currency
- Sales tax (if applicable)

**Step 5: Quick tutorial**
- Video: "3-minute tour of your Finance module"
- Key concepts: "What is accrual accounting and why it matters"
- Common tasks: "How to record an invoice vs a payment"

### Contextual Help System

**Hover Tooltips**: On every field and card
- Simple explanation of what it means
- Why it matters to your business
- Example: "Accounts Receivable: Money customers owe you for work you've done but haven't been paid for yet. Think of it as 'sales on credit'."

**"What's This?" Buttons**: Next to technical terms
- Click: Opens side panel with detailed explanation
- Visual: Diagrams showing how it works
- Example: "What is double-entry accounting?" → Shows animation of how every transaction has two sides

**In-Context Wizards**: For complex tasks
- "First time doing month-end close?" → Launch wizard
- "First time reconciling?" → Launch tutorial
- "Need help categorizing?" → AI assistant suggests

### Accrual vs Cash Explanation (Critical for SMEs)

**Toggle View**: "Show Me Numbers in Cash Basis"
- Default: Accrual (true business performance)
- Toggle: Cash basis (matches bank statements)
- Side-by-side comparison explaining differences

**Dashboard Banner** (First 3 months):
- "📚 You're using accrual accounting. This means invoices show as 'Sales' even before customers pay. This gives you the true picture of your business performance."
- "See cash-only view" → Toggles to cash basis temporarily
- Dismiss: "I understand" → Hides banner permanently

**Monthly Reconciliation Aid**:
- "Your profit this month was $10,000 but your bank only increased by $3,000. Here's why:"
  - Visual breakdown: Revenue earned vs cash collected, expenses recorded vs cash paid
  - "This is normal! Here's what happened..."

---

## 6. AI-Powered Assistance

### Smart Categorization
- **Expense description** → AI suggests category
- **Vendor name** → AI suggests historical category
- **Learning**: Improves with your patterns

### Cash Flow Forecasting
- **Predict**: "Based on your patterns, you'll need $15,000 in the next 30 days"
- **Alert**: "Warning: You might be short $3,000 in week 3"
- **Suggest**: "Consider delaying payment to Vendor X"

### Collection Assistance
- **Detect**: Late payment patterns by customer
- **Suggest**: "Customer ABC usually pays on day 45. Send reminder on day 30?"
- **Automate**: Auto-send payment reminders with escalation

### Anomaly Detection
- **Flag**: "You paid Vendor X twice this month - is this correct?"
- **Notice**: "Your electricity bill is 3x normal - check this?"
- **Alert**: "Expense pattern unusual for December"

### Intelligent Insights
- **Spot trends**: "Your consultant costs increased 40% this quarter"
- **Seasonal patterns**: "You typically collect 30% more in December"
- **Benchmarking**: "Your profit margin (15%) is below industry average (22%)"

---

## 7. Mobile Considerations

### Mobile Quick Actions
- Approve expense
- Record receipt
- Send payment reminder
- Check cash balance
- Capture receipt photo → Auto-create expense

### Mobile Alerts
- Push: "Bill of $5,000 due today"
- Push: "Low cash warning"
- Push: "Customer payment received: $10,000"

---

## 8. Compliance & Audit Trail (Behind the Scenes)

### Automatic Audit Logging
- Every transaction: Who, what, when
- Every edit: Before/after state
- Every approval: Approval chain
- Immutable: Can't be deleted, only reversed

### Compliance Checks
- **Missing tax ID**: Flags parties without required tax info
- **Suspicious patterns**: Large round numbers, duplicate entries
- **Period control**: Prevents posting to closed periods
- **Required fields**: Enforces completeness

### Accountant Access
- **Read-only mode**: Accountant can view everything
- **Report export**: Standard formats (QuickBooks, Xero compatible)
- **Audit reports**: Full trail of all transactions

---

## Summary: The Balance

### What SME Owners See:
- Business outcome language ("money in bank", "customers owe you")
- Action-oriented todos ("pay these bills today")
- Clear impact explanations ("this protects your credit rating")
- Simple workflows (wizards, drawers, smart defaults)
- Visual metaphors (cash runway, aging colors)

### What the System Does (Hidden Complexity):
- Full double-entry accrual accounting
- Proper debit/credit journal entries
- Multi-dimensional tracking
- Audit trails and compliance
- Bank reconciliation
- Financial reporting standards
- Tax calculation and tracking
- Period closing and locking

### The Bridge:
- Contextual education (tooltips, wizards, videos)
- Progressive disclosure (simple → detailed as needed)
- AI assistance (smart categorization, forecasting)
- Safety rails (validation, warnings, approvals)
- Accountant-friendly exports (when you need professional help)

This design ensures that:
1. **SME owners can run their business** without accounting knowledge
2. **The accounting is always correct** behind the scenes
3. **Accountants/auditors can trust the books** when they review
4. **Growth is supported** (as business matures, more features unlock)
5. **Compliance is maintained** (audit trails, controls, reports)
