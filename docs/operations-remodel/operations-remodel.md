# Operations Section Remodel - Comprehensive Design

## Overview
The Operations section is the central hub for managing physical and digital assets, inventory, warehouses, offices, vendors, contractors, and all operational activities.

---

## Page Structure

### Operations Dashboard (`/operations`)

#### **Top Section: Analytics Snapshot**
Six key analytics cards providing real-time operational metrics:

1. **Total Asset Value**
   - Label: "Total Asset Value"
   - Value: Sum of all assets (products + fixed assets + consumables)
   - Status: Month-over-month change %
   - Variant: primary

2. **Inventory Health**
   - Label: "Inventory Health"
   - Value: Percentage of items at optimal levels
   - Status: "X items below reorder point"
   - Variant: success/warning based on status

3. **Active Vendors**
   - Label: "Active Vendors"
   - Value: Count of vendors with active relationships
   - Status: "X new this month"
   - Variant: info

4. **Warehouse Utilization**
   - Label: "Warehouse Utilization"
   - Value: Average utilization % across all warehouses
   - Status: "X locations at capacity"
   - Variant: warning if > 90%

5. **Pending Procurement**
   - Label: "Pending Procurement"
   - Value: Count of pending purchase orders
   - Status: "Value: $XXX"
   - Variant: default

6. **Asset Maintenance Due**
   - Label: "Maintenance Due"
   - Value: Count of assets requiring maintenance
   - Status: "X overdue"
   - Variant: danger if overdue > 0

#### **Middle Section: To-Do & Alerts**
Two-column layout:

**Left Column: To-Do Panel**
- Low stock items requiring reorder
- Assets due for maintenance
- Vendor contract renewals
- Pending purchase order approvals
- Inventory cycle counts due
- New vendor onboarding tasks

**Right Column: Alerts Panel**
- Critical stock levels (red)
- Overdue maintenance (red)
- Warehouse capacity warnings (yellow)
- Vendor payment due (yellow)
- Quality issues/returns (red)
- Asset depreciation milestones (blue)

#### **Bottom Section: Quick Access Cards**
Eight quick access cards for main data tables:

1. **Products & Services**
   - Icon: Package
   - Description: "Manage inventory items and services"
   - Link: `/operations/products-services`

2. **Assets**
   - Icon: HardDrive
   - Description: "Track fixed and digital assets"
   - Link: `/operations/assets`

3. **Warehouses**
   - Icon: Warehouse
   - Description: "Manage physical storage locations"
   - Link: `/operations/warehouses`

4. **Offices**
   - Icon: Building
   - Description: "Manage office locations and resources"
   - Link: `/operations/offices`

5. **Vendors**
   - Icon: Users
   - Description: "Manage vendor relationships"
   - Link: `/operations/vendors`

6. **Contractors**
   - Icon: Briefcase
   - Description: "Manage contractor relationships"
   - Link: `/operations/contractors`

7. **Inventory Overview**
   - Icon: Database
   - Description: "View all items across locations"
   - Link: `/operations/inventory`

8. **Procurement**
   - Icon: ShoppingCart
   - Description: "Purchase orders and receiving"
   - Link: `/operations/procurement`

---

## Data Tables & Pages

### 1. Products & Services (`/operations/products-services`)

**Table Columns:**
- SKU/Code
- Name
- Type (Product/Service/Consumable)
- Category
- Current Stock (if applicable)
- Unit Price
- Cost Price
- Primary Vendor
- Status (Active/Inactive/Discontinued)
- Last Updated
- Actions

**Filters:**
- Type (All, Products, Services, Consumables)
- Category
- Status
- Stock Level (All, In Stock, Low Stock, Out of Stock)
- Vendor

**Search:** Name, SKU, Description

**Actions:**
- View Details
- Edit
- Adjust Stock (for products)
- View History
- Duplicate
- Archive

**Detail View Tabs:**
- Overview (basic info, pricing, vendors)
- Stock Levels (by warehouse)
- Purchase History
- Sales History
- Documents/Specs

---

### 2. Assets (`/operations/assets`)

**Table Columns:**
- Asset Tag
- Name
- Type (Equipment/Furniture/Vehicle/IT/Other)
- Category
- Location (Warehouse/Office)
- Assigned To (Person/Department)
- Purchase Date
- Purchase Cost
- Current Value
- Depreciation Method
- Maintenance Status
- Status (Active/Maintenance/Retired)
- Actions

**Filters:**
- Type
- Category
- Location
- Status
- Assigned To
- Maintenance Status

**Search:** Asset Tag, Name, Description

**Actions:**
- View Details
- Edit
- Transfer Location
- Assign/Unassign
- Schedule Maintenance
- Record Depreciation
- Retire

**Detail View Tabs:**
- Overview (basic info, purchase details)
- Depreciation Schedule
- Maintenance History
- Transfer History
- Documents (manuals, warranties, receipts)
- Related Expenses

---

### 3. Warehouses (`/operations/warehouses`)

**Table Columns:**
- Code
- Name
- Type (Physical Storage)
- Address
- Total Capacity (sq ft or units)
- Current Utilization %
- Active SKUs
- Total Stock Value
- Manager
- Status (Active/Inactive)
- Actions

**Filters:**
- Status
- Utilization Level (< 50%, 50-80%, > 80%)
- Manager

**Search:** Code, Name, Address

**Actions:**
- View Details
- Edit
- View Inventory
- Add Storage Location
- Generate Report
- Archive

**Detail View Tabs:**
- Overview (basic info, capacity)
- Storage Locations (bins, racks, zones)
- Inventory (current stock by SKU)
- Movements (recent in/out)
- Equipment/Assets (located here)
- Staff

---

### 4. Offices (`/operations/offices`)

**Table Columns:**
- Code
- Name
- Type (Physical/Virtual/Hybrid)
- Address (if physical)
- Capacity (seats/desks)
- Current Occupancy
- Assets Located Here
- Manager
- Monthly Cost
- Status (Active/Inactive)
- Actions

**Filters:**
- Type
- Status
- Occupancy Level

**Search:** Code, Name, Address

**Actions:**
- View Details
- Edit
- View Assets
- View Staff
- Space Planning
- Archive

**Detail View Tabs:**
- Overview (basic info, capacity)
- Assets (equipment, furniture located here)
- Staff (people assigned to this office)
- Amenities (meeting rooms, facilities)
- Expenses (rent, utilities, maintenance)
- Documents (lease, floor plans)

---

### 5. Vendors (`/operations/vendors`)

**Table Columns:**
- Vendor Code
- Name
- Type (Supplier/Service Provider/Both)
- Primary Contact
- Email
- Phone
- Categories (products/services provided)
- Active POs
- YTD Spend
- Payment Terms
- Rating (1-5 stars)
- Status (Active/Inactive/Blocked)
- Actions

**Filters:**
- Type
- Status
- Category
- Rating
- Payment Terms

**Search:** Name, Code, Email, Phone

**Actions:**
- View Details
- Edit
- Create PO
- View Purchase History
- View Performance
- Message/Contact
- Block/Unblock

**Detail View Tabs:**
- Overview (basic info, contacts)
- Products/Services (catalog items)
- Purchase History (all POs)
- Payments (payment history)
- Performance (delivery time, quality metrics)
- Documents (contracts, certifications)
- Notes/Communications

---

### 6. Contractors (`/operations/contractors`)

**Note:** Contractors share the `people` table with HR, type = 'contractor'

**Table Columns:**
- Contractor ID
- Name
- Specialization
- Company (if applicable)
- Email
- Phone
- Active Contracts
- YTD Spend
- Hourly/Project Rate
- Last Engagement
- Rating (1-5 stars)
- Status (Active/Inactive/Blocked)
- Actions

**Filters:**
- Specialization
- Status
- Company Type (Individual/Firm)
- Rating

**Search:** Name, Email, Phone, Specialization

**Actions:**
- View Details
- Edit
- Create Contract
- View Work History
- View Performance
- Message/Contact
- Block/Unblock

**Detail View Tabs:**
- Overview (basic info, specialization)
- Contracts (current and past)
- Work History (projects/tasks completed)
- Payments (payment history)
- Performance (quality, timeliness)
- Documents (contracts, certifications, insurance)
- Notes/Communications

---

### 7. Inventory Overview (`/operations/inventory`)

**Table Columns:**
- SKU
- Item Name
- Type (Product/Consumable/Asset)
- Category
- Total Quantity (across all locations)
- Warehouses (list with quantities)
- Reorder Point
- Reorder Quantity
- On Order
- Available to Promise
- Total Value
- Last Movement
- Status (OK/Low/Critical/Overstock)
- Actions

**Filters:**
- Type
- Category
- Stock Status
- Warehouse
- Movement Date Range

**Search:** SKU, Name

**Actions:**
- View Details
- Adjust Stock
- Transfer
- Create PO
- View Movements
- View Forecast

**Detail View Tabs:**
- Stock Levels (by warehouse/location)
- Movement History (in/out transactions)
- Purchase Orders (pending receipts)
- Sales Orders (pending fulfillments)
- Forecast (demand planning)
- Cost Analysis (FIFO/LIFO/Average)

---

### 8. Procurement (`/operations/procurement`)

**Table Columns:**
- PO Number
- Vendor
- Date
- Expected Delivery
- Status (Draft/Sent/Partially Received/Received/Cancelled)
- Line Items Count
- Total Amount
- Received %
- Created By
- Actions

**Filters:**
- Status
- Vendor
- Date Range
- Created By

**Search:** PO Number, Vendor Name

**Actions:**
- View Details
- Edit (if draft)
- Send to Vendor
- Receive Items
- Cancel
- Print/Export

**Detail View:**
- Header (vendor, dates, terms)
- Line Items (with receive quantities)
- Receiving History
- Linked Invoices
- Notes/Communications

---

## Record Operations Activity Drawer

### Primary Entry Point
**Button:** "Record Operations Activity" (fixed position, bottom-right or top-right)

### Drawer Structure
When opened, displays a grid of activity cards (2 columns on desktop, 1 on mobile):

#### **1. Add Item Card**
- Icon: Plus Circle
- Title: "Add Item"
- Description: "Add new product, service, consumable, or asset"
- Click Action: Shows sub-menu

**Sub-Menu (4 Cards):**

##### A. Add Product
- Form Fields:
  - **Basic Info:**
    - Name* (text)
    - SKU* (text, auto-generated option)
    - Description (textarea)
    - Category* (select)
    - Type* (Finished Goods/Raw Materials/Components)
  - **Pricing:**
    - Cost Price* (number)
    - Unit Price* (number)
    - Margin % (calculated, read-only)
    - Currency* (select, default from tenant)
  - **Inventory:**
    - Unit of Measure* (select)
    - Reorder Point (number)
    - Reorder Quantity (number)
    - Initial Stock (number)
    - Initial Warehouse* (select, if stock > 0)
    - Storage Location (select, filtered by warehouse)
  - **Vendor:**
    - Primary Vendor (select)
    - Vendor SKU (text)
    - Lead Time (days)
  - **Additional:**
    - Barcode (text)
    - Weight (number + unit)
    - Dimensions (L x W x H)
    - Is Active (checkbox, default true)
    - Track Serial Numbers (checkbox)
    - Track Lot Numbers (checkbox)
  - **Documents:**
    - Upload Images (multiple)
    - Upload Spec Sheets (multiple)

##### B. Add Service
- Form Fields:
  - **Basic Info:**
    - Name* (text)
    - Service Code* (text, auto-generated option)
    - Description (textarea)
    - Category* (select)
    - Type* (Consulting/Maintenance/Installation/Other)
  - **Pricing:**
    - Hourly Rate (number)
    - Daily Rate (number)
    - Fixed Price (number)
    - Currency* (select)
  - **Service Details:**
    - Estimated Duration (hours/days)
    - Required Skills (multi-select)
    - Service Level (Standard/Premium/Enterprise)
  - **Vendor/Contractor:**
    - Default Provider (select from vendors/contractors)
    - External Cost (if outsourced)
  - **Additional:**
    - Is Active (checkbox)
    - Billable (checkbox)
    - Requires Approval (checkbox)

##### C. Add Consumable
- Form Fields:
  - **Basic Info:**
    - Name* (text)
    - SKU* (text)
    - Description (textarea)
    - Category* (Office Supplies/Cleaning/Safety/IT/Other)
  - **Inventory:**
    - Unit of Measure* (select)
    - Cost Price* (number)
    - Reorder Point (number)
    - Reorder Quantity (number)
    - Initial Stock (number)
    - Initial Warehouse* (select)
  - **Vendor:**
    - Primary Vendor (select)
    - Vendor SKU (text)
  - **Additional:**
    - Expiry Tracking (checkbox)
    - Default Expiry Period (days)
    - Is Active (checkbox)

##### D. Add Asset
- Form Fields:
  - **Basic Info:**
    - Asset Tag* (text, auto-generated option)
    - Name* (text)
    - Description (textarea)
    - Type* (Equipment/Furniture/Vehicle/IT Equipment/Other)
    - Category* (select, filtered by type)
  - **Purchase Details:**
    - Purchase Date* (date)
    - Purchase Cost* (number)
    - Vendor* (select)
    - Invoice Number (text)
    - Warranty Period (months)
    - Warranty Expiry (date, calculated)
  - **Depreciation:**
    - Depreciation Method* (Straight Line/Declining Balance/None)
    - Useful Life (years)
    - Salvage Value (number)
    - Current Book Value (calculated, read-only)
  - **Location & Assignment:**
    - Location Type* (Warehouse/Office)
    - Warehouse/Office* (select)
    - Assigned To (select from people)
    - Assignment Date (date)
  - **Maintenance:**
    - Requires Maintenance (checkbox)
    - Maintenance Frequency (select: Monthly/Quarterly/Yearly)
    - Next Maintenance Due (date)
  - **Additional:**
    - Serial Number (text)
    - Model Number (text)
    - Manufacturer (text)
    - Status* (Active/In Maintenance/Retired)
  - **Documents:**
    - Upload Images (multiple)
    - Upload Manuals (multiple)
    - Upload Receipts/Invoices (multiple)

#### **2. Receive Stock Card**
- Icon: Package Check
- Title: "Receive Stock"
- Description: "Receive items from purchase orders"
- Click Action: Shows receive form

**Receive Form:**
- Select PO* (dropdown with pending POs)
- OR Direct Receipt (no PO)
  - Vendor* (select)
  - Invoice Number (text)
  - Invoice Date (date)
- Line Items (auto-populated from PO):
  - Product
  - Ordered Qty
  - Previously Received
  - Receive Now* (number input)
  - Warehouse* (select)
  - Storage Location (select)
  - Lot Number (if tracked)
  - Serial Numbers (if tracked, multiple)
  - Notes
- Receipt Date* (date, default today)
- Notes (textarea)

#### **3. Issue Stock Card**
- Icon: Package Minus
- Title: "Issue Stock"
- Description: "Issue items from inventory"
- Click Action: Shows issue form

**Issue Form:**
- Issue Type* (select):
  - Production Use
  - Internal Consumption
  - Damage/Obsolescence
  - Transfer Between Warehouses
  - Other
- Multiple Line Items:
  - Product* (select)
  - From Warehouse* (select)
  - From Location (select)
  - Quantity* (number)
  - To Warehouse (if transfer)
  - To Location (if transfer)
  - Reason (select based on type)
  - Cost Center/Project (optional dimension)
  - Notes
- Issue Date* (date)
- Authorized By (select from users)
- Notes (textarea)

#### **4. Transfer Stock Card**
- Icon: Repeat
- Title: "Transfer Stock"
- Description: "Transfer items between locations"
- Click Action: Shows transfer form

**Transfer Form:**
- Multiple Line Items:
  - Product* (select)
  - From Warehouse* (select)
  - From Location (select)
  - To Warehouse* (select)
  - To Location (select)
  - Quantity* (number)
  - Available Qty (display, read-only)
  - Transfer Reason (select)
  - Notes
- Transfer Date* (date)
- Reference Number (text)
- Requested By (select)
- Approved By (select, if requires approval)
- Notes (textarea)

#### **5. Adjust Inventory Card**
- Icon: Edit
- Title: "Adjust Inventory"
- Description: "Correct inventory discrepancies"
- Click Action: Shows adjustment form

**Adjustment Form:**
- Adjustment Reason* (select):
  - Physical Count Discrepancy
  - Damage/Breakage
  - Theft/Loss
  - Found/Discovered
  - System Error
  - Other
- Multiple Line Items:
  - Product* (select)
  - Warehouse* (select)
  - Location (select)
  - Current Qty (display, read-only)
  - Adjusted Qty* (number)
  - Difference (calculated, read-only)
  - Unit Cost (display, read-only)
  - Total Value Impact (calculated, read-only)
  - Notes
- Adjustment Date* (date)
- Counted By (select from users)
- Approved By* (select from users, required for adjustments)
- Supporting Documents (upload)
- Notes (textarea)

#### **6. Schedule Maintenance Card**
- Icon: Tool
- Title: "Schedule Maintenance"
- Description: "Schedule asset maintenance"
- Click Action: Shows maintenance form

**Maintenance Form:**
- Asset* (select)
- Maintenance Type* (select):
  - Preventive
  - Corrective
  - Emergency
  - Inspection
- Scheduled Date* (date)
- Estimated Duration (hours)
- Assigned To* (select from people/contractors)
- Priority* (Low/Medium/High/Critical)
- Description* (textarea)
- Required Parts (multi-select from consumables)
- Estimated Cost (number)
- Notes (textarea)

#### **7. Record Asset Transfer Card**
- Icon: Move
- Title: "Record Asset Transfer"
- Description: "Transfer asset to new location or person"
- Click Action: Shows transfer form

**Asset Transfer Form:**
- Asset* (select)
- Current Location (display, read-only)
- Current Assignee (display, read-only)
- Transfer Type* (select):
  - Location Change Only
  - Assignment Change Only
  - Both Location and Assignment
- New Location (warehouse/office, conditional)
- New Assignee (person, conditional)
- Transfer Date* (date)
- Transfer Reason* (select):
  - Employee Transfer
  - Department Change
  - Workspace Reorganization
  - Repair/Maintenance
  - Other
- Condition* (select):
  - Excellent
  - Good
  - Fair
  - Poor
  - Needs Repair
- Approved By* (select)
- Notes (textarea)
- Photos (upload, optional)

#### **8. Add Vendor Card**
- Icon: User Plus
- Title: "Add Vendor"
- Description: "Add new vendor or supplier"
- Click Action: Shows vendor form

**Vendor Form:**
- **Basic Info:**
  - Vendor Code* (text, auto-generated option)
  - Legal Name* (text)
  - Trading Name (text)
  - Type* (Supplier/Service Provider/Both)
  - Status* (Active/Inactive, default Active)
- **Contact:**
  - Primary Contact Name* (text)
  - Email* (email)
  - Phone* (tel)
  - Alternative Phone (tel)
  - Website (url)
- **Address:**
  - Street Address* (text)
  - City* (text)
  - State/Province (text)
  - Postal Code (text)
  - Country* (select)
- **Financial:**
  - Currency* (select)
  - Payment Terms* (select: Net 30/Net 60/Due on Receipt/Custom)
  - Credit Limit (number)
  - Tax ID/VAT Number (text)
  - Bank Account Info (expandable section)
- **Categories:**
  - Product Categories (multi-select)
  - Service Categories (multi-select)
- **Performance:**
  - Initial Rating (1-5 stars, default 3)
- **Documents:**
  - Upload Contracts (multiple)
  - Upload Certifications (multiple)
  - Upload Tax Documents (multiple)
- **Notes:**
  - Internal Notes (textarea)

#### **9. Add Contractor Card**
- Icon: Briefcase
- Title: "Add Contractor"
- Description: "Add new contractor or freelancer"
- Click Action: Shows contractor form

**Contractor Form:**
- **Basic Info:**
  - Contractor Type* (Individual/Firm)
  - First Name* (text)
  - Last Name* (text)
  - Company Name (text, if firm)
  - Specialization* (multi-select)
  - Status* (Active/Inactive, default Active)
- **Contact:**
  - Email* (email)
  - Phone* (tel)
  - Alternative Phone (tel)
  - Website/Portfolio (url)
  - LinkedIn (url)
- **Address:**
  - Street Address (text)
  - City (text)
  - State/Province (text)
  - Postal Code (text)
  - Country* (select)
- **Contract Details:**
  - Rate Type* (Hourly/Daily/Project-based)
  - Hourly Rate (number, if applicable)
  - Daily Rate (number, if applicable)
  - Currency* (select)
  - Availability (Full-time/Part-time/As Needed)
- **Skills & Certifications:**
  - Skills (multi-select tags)
  - Certifications (text, multiple)
  - Languages (multi-select)
  - Years of Experience (number)
- **Financial:**
  - Payment Terms* (select)
  - Tax Classification (W-2/1099/International)
  - Tax ID/SSN (text, encrypted)
  - Bank Account Info (expandable section)
- **Insurance:**
  - Liability Insurance (checkbox)
  - Policy Number (text)
  - Expiry Date (date)
  - Upload Policy (file)
- **Performance:**
  - Initial Rating (1-5 stars, default 3)
- **Documents:**
  - Upload Resume/CV (file)
  - Upload Portfolio (multiple)
  - Upload Certifications (multiple)
  - Upload Contracts (multiple)
- **Notes:**
  - Internal Notes (textarea)

#### **10. Create Purchase Order Card**
- Icon: Shopping Cart
- Title: "Create Purchase Order"
- Description: "Create new purchase order"
- Click Action: Shows PO form

**Purchase Order Form:**
- **Header:**
  - PO Number (auto-generated, display)
  - Vendor* (select)
  - PO Date* (date, default today)
  - Expected Delivery Date* (date)
  - Payment Terms* (auto-filled from vendor, editable)
  - Currency* (auto-filled from vendor)
  - Delivery Address* (select: warehouse/office)
  - Requestor (auto-filled, current user)
- **Line Items:** (Multiple)
  - Product/Service* (select)
  - Description (auto-filled, editable)
  - Quantity* (number)
  - Unit Price* (number, auto-filled if available)
  - Tax (select tax category)
  - Discount % (number)
  - Line Total (calculated, read-only)
  - Expected Delivery (date)
  - Notes
- **Totals:**
  - Subtotal (calculated, read-only)
  - Tax Amount (calculated, read-only)
  - Discount Amount (calculated, read-only)
  - Total Amount (calculated, read-only)
- **Additional:**
  - Special Instructions (textarea)
  - Delivery Instructions (textarea)
  - Internal Notes (textarea)
  - Requires Approval (checkbox)
- **Actions:**
  - Save as Draft
  - Send to Vendor
  - Save and Send

---

## Improvements to Existing Workflows

### 1. Warehouse Management Enhancements
- Add capacity planning tools
- Visual warehouse map (floor plan upload)
- Heat maps showing high-activity zones
- Space utilization analytics
- Automated reorder point suggestions based on lead time and consumption

### 2. Asset Management Enhancements
- Asset lifecycle visualization (purchase → active → maintenance → retirement)
- Depreciation dashboard with forecasting
- Maintenance calendar view
- QR code generation for asset tags
- Mobile asset scanning capability
- Asset utilization tracking (for shared assets)

### 3. Vendor/Contractor Management Enhancements
- Performance scoring dashboard
  - On-time delivery rate
  - Quality score (based on returns/issues)
  - Price competitiveness
  - Responsiveness
- Vendor comparison tool
- Contract renewal reminders
- Vendor portal (optional, future)
- Spend analysis by vendor/category

### 4. Inventory Management Enhancements
- ABC analysis (classify items by value/importance)
- Stock aging report
- Dead stock identification
- Demand forecasting (based on historical data)
- Safety stock calculations
- Multi-currency inventory valuation
- Lot/serial number tracking and traceability
- Expiry date management for consumables

### 5. Procurement Enhancements
- PO approval workflows (based on amount thresholds)
- Three-way matching (PO → Receipt → Invoice)
- Vendor price comparison during PO creation
- Blanket POs for recurring purchases
- PO templates for common orders
- Automated PO generation from reorder points
- Email notifications to vendors

---

## Database Schema Considerations

### New Tables Needed

#### **offices**
```sql
CREATE TABLE offices (
  id UUID PRIMARY KEY,
  tenantId UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL, -- physical, virtual, hybrid
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  postalCode VARCHAR(20),
  country VARCHAR(100),
  capacity INT, -- number of seats/desks
  currentOccupancy INT,
  managerId UUID, -- references users
  monthlyCost DECIMAL(15,2),
  leaseStartDate DATE,
  leaseEndDate DATE,
  status VARCHAR(50) NOT NULL, -- active, inactive
  metadata JSONB,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL,
  UNIQUE(tenantId, code)
);
```

#### **office_assets** (linking table)
```sql
CREATE TABLE office_assets (
  id UUID PRIMARY KEY,
  tenantId UUID NOT NULL,
  officeId UUID NOT NULL,
  assetId UUID NOT NULL,
  assignedDate DATE NOT NULL,
  removedDate DATE,
  createdAt TIMESTAMP NOT NULL
);
```

#### **asset_transfers**
```sql
CREATE TABLE asset_transfers (
  id UUID PRIMARY KEY,
  tenantId UUID NOT NULL,
  assetId UUID NOT NULL,
  fromLocationType VARCHAR(50), -- warehouse, office
  fromLocationId UUID,
  fromAssigneeId UUID,
  toLocationType VARCHAR(50),
  toLocationId UUID,
  toAssigneeId UUID,
  transferDate DATE NOT NULL,
  transferReason VARCHAR(100),
  condition VARCHAR(50),
  approvedBy UUID NOT NULL,
  notes TEXT,
  metadata JSONB,
  createdAt TIMESTAMP NOT NULL,
  createdBy UUID NOT NULL
);
```

#### **asset_maintenance_schedules**
```sql
CREATE TABLE asset_maintenance_schedules (
  id UUID PRIMARY KEY,
  tenantId UUID NOT NULL,
  assetId UUID NOT NULL,
  maintenanceType VARCHAR(50) NOT NULL, -- preventive, corrective, emergency, inspection
  scheduledDate DATE NOT NULL,
  completedDate DATE,
  estimatedDuration INT, -- hours
  actualDuration INT,
  assignedToId UUID, -- person or contractor
  priority VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  requiredParts JSONB, -- array of product IDs
  estimatedCost DECIMAL(15,2),
  actualCost DECIMAL(15,2),
  status VARCHAR(50) NOT NULL, -- scheduled, in_progress, completed, cancelled
  notes TEXT,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);
```

### Schema Enhancements to Existing Tables

#### **parties** (already exists, add indexes)
- Add index on `type` for faster contractor/vendor queries
- Add `rating` field (1-5)
- Add `lastInteractionDate` field

#### **products** (already exists, enhancements)
- Add `trackSerialNumbers` boolean
- Add `trackLotNumbers` boolean
- Add `expiryTracking` boolean
- Add `defaultExpiryDays` int

#### **warehouses** (already exists, enhancements)
- Add `totalCapacity` decimal (sq ft or units)
- Add `capacityUnit` varchar (sqft/cubic_meters/units)
- Add `currentUtilization` decimal (calculated)
- Add `floorPlanUrl` text

---

## API Routes Needed

### Operations Routes

#### **Office Management**
- `GET /api/operations/offices` - List offices
- `POST /api/operations/offices` - Create office
- `GET /api/operations/offices/[id]` - Get office details
- `PATCH /api/operations/offices/[id]` - Update office
- `DELETE /api/operations/offices/[id]` - Archive office
- `GET /api/operations/offices/[id]/assets` - List assets in office
- `POST /api/operations/offices/[id]/assets` - Assign asset to office
- `DELETE /api/operations/offices/[id]/assets/[assetId]` - Remove asset
- `GET /api/operations/offices/[id]/staff` - List staff in office

#### **Asset Management**
- `GET /api/operations/assets` - List assets (exists, enhance)
- `POST /api/operations/assets` - Create asset (exists, enhance)
- `GET /api/operations/assets/[id]` - Get asset details
- `PATCH /api/operations/assets/[id]` - Update asset
- `POST /api/operations/assets/[id]/transfer` - Transfer asset
- `GET /api/operations/assets/[id]/transfer-history` - Transfer history
- `POST /api/operations/assets/[id]/maintenance` - Schedule maintenance
- `GET /api/operations/assets/[id]/maintenance-history` - Maintenance history
- `POST /api/operations/assets/[id]/depreciation` - Record depreciation

#### **Vendor Management** (extend parties)
- `GET /api/operations/vendors` - List vendors (filter parties by type)
- `POST /api/operations/vendors` - Create vendor
- `GET /api/operations/vendors/[id]` - Get vendor details
- `PATCH /api/operations/vendors/[id]` - Update vendor
- `GET /api/operations/vendors/[id]/products` - Vendor catalog
- `GET /api/operations/vendors/[id]/performance` - Vendor performance metrics
- `POST /api/operations/vendors/[id]/rate` - Rate vendor

#### **Contractor Management** (extend parties/people)
- `GET /api/operations/contractors` - List contractors
- `POST /api/operations/contractors` - Create contractor
- `GET /api/operations/contractors/[id]` - Get contractor details
- `PATCH /api/operations/contractors/[id]` - Update contractor
- `GET /api/operations/contractors/[id]/work-history` - Work history
- `GET /api/operations/contractors/[id]/performance` - Performance metrics
- `POST /api/operations/contractors/[id]/rate` - Rate contractor

#### **Inventory Operations**
- `POST /api/operations/inventory/receive` - Receive stock
- `POST /api/operations/inventory/issue` - Issue stock
- `POST /api/operations/inventory/transfer` - Transfer stock
- `POST /api/operations/inventory/adjust` - Adjust inventory
- `GET /api/operations/inventory/movements` - Movement history
- `GET /api/operations/inventory/balances` - Current balances (exists)

#### **Analytics**
- `GET /api/operations/analytics/overview` - Operations overview metrics
- `GET /api/operations/analytics/inventory-health` - Inventory health metrics
- `GET /api/operations/analytics/vendor-performance` - Vendor performance
- `GET /api/operations/analytics/asset-utilization` - Asset utilization
- `GET /api/operations/analytics/warehouse-utilization` - Warehouse utilization

---

## UI Component Structure

### Page Components

```typescript
// /src/app/(app)/operations/page.tsx
export default function OperationsPage() {
  return (
    <div className="space-y-6">
      {/* Analytics Section */}
      <AnalyticsSection>
        <AnalyticsCard variant="primary" label="Total Asset Value" value="$2.5M" status="+12% vs last month" />
        <AnalyticsCard variant="success" label="Inventory Health" value="94%" status="12 items low stock" />
        <AnalyticsCard variant="info" label="Active Vendors" value="48" status="3 new this month" />
        <AnalyticsCard variant="warning" label="Warehouse Utilization" value="78%" status="2 locations > 90%" />
        <AnalyticsCard variant="default" label="Pending Procurement" value="23" status="Value: $145K" />
        <AnalyticsCard variant="danger" label="Maintenance Due" value="8" status="3 overdue" />
      </AnalyticsSection>

      {/* To-Do & Alerts Section */}
      <TodoAlertsSection>
        <TodoPanel items={todos} />
        <AlertsPanel alerts={alerts} />
      </TodoAlertsSection>

      {/* Quick Access Section */}
      <QuickAccessSection title="Quick Access">
        <QuickAccessCard
          icon={Package}
          title="Products & Services"
          description="Manage inventory items and services"
          href="/operations/products-services"
        />
        <QuickAccessCard
          icon={HardDrive}
          title="Assets"
          description="Track fixed and digital assets"
          href="/operations/assets"
        />
        <QuickAccessCard
          icon={Warehouse}
          title="Warehouses"
          description="Manage physical storage locations"
          href="/operations/warehouses"
        />
        <QuickAccessCard
          icon={Building}
          title="Offices"
          description="Manage office locations and resources"
          href="/operations/offices"
        />
        <QuickAccessCard
          icon={Users}
          title="Vendors"
          description="Manage vendor relationships"
          href="/operations/vendors"
        />
        <QuickAccessCard
          icon={Briefcase}
          title="Contractors"
          description="Manage contractor relationships"
          href="/operations/contractors"
        />
        <QuickAccessCard
          icon={Database}
          title="Inventory Overview"
          description="View all items across locations"
          href="/operations/inventory"
        />
        <QuickAccessCard
          icon={ShoppingCart}
          title="Procurement"
          description="Purchase orders and receiving"
          href="/operations/procurement"
        />
      </QuickAccessSection>

      {/* Record Operations Button */}
      <RecordOperationsButton />
    </div>
  );
}
```

### Record Operations Drawer Component

```typescript
// /src/components/operations/record-operations-drawer.tsx
export function RecordOperationsDrawer() {
  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Record Operations Activity">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ActivityCard
          icon={PlusCircle}
          title="Add Item"
          description="Add new product, service, consumable, or asset"
          onClick={() => setView('add-item')}
        />
        <ActivityCard
          icon={PackageCheck}
          title="Receive Stock"
          description="Receive items from purchase orders"
          onClick={() => setView('receive-stock')}
        />
        <ActivityCard
          icon={PackageMinus}
          title="Issue Stock"
          description="Issue items from inventory"
          onClick={() => setView('issue-stock')}
        />
        <ActivityCard
          icon={Repeat}
          title="Transfer Stock"
          description="Transfer items between locations"
          onClick={() => setView('transfer-stock')}
        />
        <ActivityCard
          icon={Edit}
          title="Adjust Inventory"
          description="Correct inventory discrepancies"
          onClick={() => setView('adjust-inventory')}
        />
        <ActivityCard
          icon={Tool}
          title="Schedule Maintenance"
          description="Schedule asset maintenance"
          onClick={() => setView('schedule-maintenance')}
        />
        <ActivityCard
          icon={Move}
          title="Record Asset Transfer"
          description="Transfer asset to new location or person"
          onClick={() => setView('asset-transfer')}
        />
        <ActivityCard
          icon={UserPlus}
          title="Add Vendor"
          description="Add new vendor or supplier"
          onClick={() => setView('add-vendor')}
        />
        <ActivityCard
          icon={Briefcase}
          title="Add Contractor"
          description="Add new contractor or freelancer"
          onClick={() => setView('add-contractor')}
        />
        <ActivityCard
          icon={ShoppingCart}
          title="Create Purchase Order"
          description="Create new purchase order"
          onClick={() => setView('create-po')}
        />
      </div>

      {/* Nested views for each activity */}
      {view === 'add-item' && <AddItemMenu />}
      {view === 'receive-stock' && <ReceiveStockForm />}
      {/* ... other views */}
    </SlideOver>
  );
}
```

---

## Key Features & Differentiators

### 1. Unified Operations Hub
- Single dashboard for all operational metrics
- Contextual alerts and to-dos
- Quick access to all operations functions

### 2. Smart Inventory Management
- Real-time stock levels across locations
- Automated reorder point alerts
- ABC analysis for inventory optimization
- Lot/serial number tracking
- Expiry date management

### 3. Comprehensive Asset Lifecycle
- Purchase to retirement tracking
- Automated depreciation
- Maintenance scheduling and history
- Transfer history and audit trail
- QR code integration

### 4. Vendor & Contractor Intelligence
- Performance scoring and ratings
- Spend analysis
- Contract renewal tracking
- Comparative analytics

### 5. Streamlined Data Entry
- Single-point entry drawer
- Context-aware forms
- Auto-population from master data
- Mobile-friendly interface

### 6. Location Management
- Physical and virtual offices
- Warehouse capacity planning
- Space utilization analytics
- Asset-location tracking

### 7. Audit & Compliance
- Complete transaction history
- Approval workflows
- Document management
- Audit trail for all changes

---

## Mobile Optimization

### Responsive Breakpoints
- Desktop (1024px+): Full layout with 2-3 column grids
- Tablet (768px-1023px): 2-column grids, condensed tables
- Mobile (< 768px): Single column, collapsible sections

### Mobile-Specific Features
- Bottom sheet for Record Operations (instead of side drawer)
- Swipe actions on table rows
- Touch-optimized form inputs
- QR code scanner for asset/product lookup
- Offline capability for inventory movements (sync later)

---

## Performance Considerations

### Data Loading
- Paginated tables (50 items per page default)
- Lazy loading for images
- Virtual scrolling for large lists
- Optimistic UI updates for better perceived performance

### Caching Strategy
- Cache master data (products, vendors, warehouses) in browser
- Invalidate on mutations
- Background refresh for analytics data

### Search & Filtering
- Debounced search (300ms)
- Server-side filtering for large datasets
- Client-side filtering for < 100 items

---

## Security Considerations

### Access Control
- Role-based permissions for each operation
- Approval workflows for sensitive actions (adjustments, transfers)
- Audit logging for all transactions

### Data Validation
- Input validation on client and server
- Business rule validation (e.g., can't issue more than available)
- Duplicate detection (e.g., same PO number)

---

## Future Enhancements (Phase 2)

1. **Barcode/QR Code Integration**
   - Generate codes for all items/assets
   - Mobile scanning for quick lookup
   - Print label templates

2. **IoT Integration**
   - RFID tracking for assets
   - Environmental sensors for warehouses
   - Automated stock counting

3. **Advanced Analytics**
   - Predictive maintenance for assets
   - Demand forecasting for inventory
   - Vendor risk scoring

4. **Vendor Portal**
   - Allow vendors to view/update POs
   - Automatic ASN (Advanced Shipping Notice)
   - Invoice submission

5. **Mobile App**
   - Native iOS/Android apps
   - Offline-first architecture
   - Push notifications for alerts

6. **AI/ML Features**
   - Anomaly detection in inventory
   - Optimal reorder point suggestions
   - Vendor price prediction

---

## Implementation Priority

### Phase 1 (MVP)
1. Operations dashboard with analytics
2. Record Operations drawer with core activities
3. Products & Services data table
4. Assets data table with basic tracking
5. Warehouses data table
6. Basic inventory operations (receive, issue, adjust)

### Phase 2
1. Offices data table
2. Vendors data table with performance tracking
3. Contractors data table
4. Enhanced asset management (transfers, maintenance)
5. Advanced inventory (lot/serial tracking)

### Phase 3
1. Procurement workflow enhancements
2. Advanced analytics and reporting
3. Mobile optimizations
4. QR code/barcode integration

---

## Conclusion

This comprehensive remodel transforms the Operations section into a powerful, user-friendly hub for managing all operational aspects of the business. The design prioritizes:

- **Ease of Use**: Single-point entry for all operations activities
- **Visibility**: Clear analytics and alerts on the main dashboard
- **Efficiency**: Quick access cards for common data tables
- **Completeness**: Industry-standard forms for all master data
- **Flexibility**: Supports various business models and workflows
- **Scalability**: Architecture supports growth and future enhancements

The modular design allows for incremental implementation while maintaining consistency with the rest of the UDP application.
