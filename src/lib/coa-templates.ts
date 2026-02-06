/**
 * Chart of Accounts Templates for SME Onboarding
 *
 * Pre-defined account structures for different industries
 */

export interface CoAAccount {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  description?: string;
}

export interface CoATemplate {
  id: string;
  name: string;
  description: string;
  industry: string;
  accounts: CoAAccount[];
}

/**
 * Common accounts shared across all templates
 */
const commonAccounts: CoAAccount[] = [
  // Assets
  { code: "1000", name: "Cash", type: "asset", description: "Operating cash" },
  { code: "1010", name: "Petty Cash", type: "asset", description: "Petty cash fund" },
  { code: "1100", name: "Checking Account", type: "asset", description: "Main business checking" },
  { code: "1110", name: "Savings Account", type: "asset", description: "Business savings" },
  { code: "1200", name: "Accounts Receivable", type: "asset", description: "Customer receivables" },
  { code: "1210", name: "Allowance for Doubtful Accounts", type: "asset", description: "Bad debt provision" },
  { code: "1300", name: "Prepaid Expenses", type: "asset", description: "Prepaid items" },
  { code: "1310", name: "Prepaid Insurance", type: "asset", description: "Insurance prepayments" },
  { code: "1320", name: "Prepaid Rent", type: "asset", description: "Rent prepayments" },

  // Fixed Assets
  { code: "1500", name: "Furniture & Fixtures", type: "asset", description: "Office furniture" },
  { code: "1510", name: "Accumulated Depreciation - F&F", type: "asset", description: "Depreciation for furniture" },
  { code: "1520", name: "Equipment", type: "asset", description: "Business equipment" },
  { code: "1530", name: "Accumulated Depreciation - Equipment", type: "asset", description: "Depreciation for equipment" },
  { code: "1540", name: "Vehicles", type: "asset", description: "Business vehicles" },
  { code: "1550", name: "Accumulated Depreciation - Vehicles", type: "asset", description: "Depreciation for vehicles" },

  // Liabilities
  { code: "2000", name: "Accounts Payable", type: "liability", description: "Vendor payables" },
  { code: "2100", name: "Accrued Expenses", type: "liability", description: "Accrued liabilities" },
  { code: "2110", name: "Wages Payable", type: "liability", description: "Unpaid wages" },
  { code: "2120", name: "Taxes Payable", type: "liability", description: "Tax liabilities" },
  { code: "2200", name: "Credit Card Payable", type: "liability", description: "Credit card balances" },
  { code: "2300", name: "Customer Deposits", type: "liability", description: "Advance payments received" },
  { code: "2500", name: "Notes Payable", type: "liability", description: "Short-term loans" },
  { code: "2600", name: "Long-term Debt", type: "liability", description: "Long-term loans" },

  // Equity
  { code: "3000", name: "Owner's Capital", type: "equity", description: "Owner investment" },
  { code: "3100", name: "Owner's Draws", type: "equity", description: "Owner withdrawals" },
  { code: "3200", name: "Retained Earnings", type: "equity", description: "Accumulated profits" },

  // Operating Expenses (common)
  { code: "6000", name: "Salaries & Wages", type: "expense", description: "Employee compensation" },
  { code: "6010", name: "Payroll Taxes", type: "expense", description: "Employer payroll taxes" },
  { code: "6020", name: "Employee Benefits", type: "expense", description: "Health insurance, etc." },
  { code: "6100", name: "Rent Expense", type: "expense", description: "Office/facility rent" },
  { code: "6110", name: "Utilities", type: "expense", description: "Electric, gas, water" },
  { code: "6120", name: "Telephone & Internet", type: "expense", description: "Communications" },
  { code: "6200", name: "Office Supplies", type: "expense", description: "Office consumables" },
  { code: "6210", name: "Postage & Shipping", type: "expense", description: "Mailing costs" },
  { code: "6300", name: "Insurance Expense", type: "expense", description: "Business insurance" },
  { code: "6400", name: "Professional Fees", type: "expense", description: "Legal, accounting, etc." },
  { code: "6500", name: "Advertising & Marketing", type: "expense", description: "Marketing costs" },
  { code: "6600", name: "Travel & Entertainment", type: "expense", description: "Business travel" },
  { code: "6700", name: "Depreciation Expense", type: "expense", description: "Asset depreciation" },
  { code: "6800", name: "Bank Charges", type: "expense", description: "Bank fees" },
  { code: "6900", name: "Miscellaneous Expense", type: "expense", description: "Other expenses" },

  // Other Income/Expense
  { code: "7100", name: "Interest Income", type: "income", description: "Bank interest" },
  { code: "8100", name: "Interest Expense", type: "expense", description: "Loan interest" },
  { code: "9000", name: "Gain/Loss on Asset Sale", type: "expense", description: "Asset disposal" },
];

/**
 * General/Default Template
 */
const generalTemplate: CoATemplate = {
  id: "general",
  name: "General Business",
  description: "Standard chart of accounts suitable for most small businesses",
  industry: "General",
  accounts: [
    ...commonAccounts,
    // Revenue
    { code: "4000", name: "Sales Revenue", type: "income", description: "Product/service sales" },
    { code: "4100", name: "Service Revenue", type: "income", description: "Services provided" },
    { code: "4200", name: "Other Revenue", type: "income", description: "Miscellaneous income" },
    // Cost of Sales
    { code: "5000", name: "Cost of Goods Sold", type: "expense", description: "Direct product costs" },
    { code: "5100", name: "Cost of Services", type: "expense", description: "Direct service costs" },
  ],
};

/**
 * Retail Business Template
 */
const retailTemplate: CoATemplate = {
  id: "retail",
  name: "Retail Business",
  description: "Optimized for retail stores and e-commerce businesses",
  industry: "Retail",
  accounts: [
    ...commonAccounts,
    // Inventory Assets
    { code: "1400", name: "Inventory", type: "asset", description: "Merchandise inventory" },
    { code: "1410", name: "Inventory in Transit", type: "asset", description: "Goods in shipping" },
    // Revenue
    { code: "4000", name: "Product Sales", type: "income", description: "Retail product sales" },
    { code: "4010", name: "Sales Returns & Allowances", type: "income", description: "Returns and discounts" },
    { code: "4020", name: "Shipping Revenue", type: "income", description: "Shipping charges collected" },
    { code: "4100", name: "Gift Card Revenue", type: "income", description: "Gift card sales" },
    // Cost of Sales
    { code: "5000", name: "Cost of Goods Sold", type: "expense", description: "Product costs" },
    { code: "5010", name: "Inventory Shrinkage", type: "expense", description: "Loss and theft" },
    { code: "5020", name: "Freight In", type: "expense", description: "Inbound shipping costs" },
    { code: "5100", name: "Packaging Materials", type: "expense", description: "Shipping supplies" },
    // Retail-specific expenses
    { code: "6510", name: "Store Fixtures", type: "expense", description: "Display and fixtures" },
    { code: "6520", name: "Point of Sale Fees", type: "expense", description: "POS system costs" },
    { code: "6530", name: "Credit Card Processing", type: "expense", description: "Payment processing fees" },
  ],
};

/**
 * Professional Services Template
 */
const servicesTemplate: CoATemplate = {
  id: "services",
  name: "Professional Services",
  description: "For consulting, legal, accounting, and other service businesses",
  industry: "Professional Services",
  accounts: [
    ...commonAccounts,
    // Service-specific assets
    { code: "1400", name: "Work in Progress", type: "asset", description: "Unbilled work" },
    // Revenue
    { code: "4000", name: "Professional Fees", type: "income", description: "Service fees" },
    { code: "4010", name: "Consulting Revenue", type: "income", description: "Consulting services" },
    { code: "4020", name: "Retainer Income", type: "income", description: "Monthly retainers" },
    { code: "4100", name: "Reimbursable Expenses", type: "income", description: "Client reimbursements" },
    // Cost of Services
    { code: "5000", name: "Direct Labor", type: "expense", description: "Billable staff costs" },
    { code: "5010", name: "Subcontractor Fees", type: "expense", description: "Outsourced work" },
    { code: "5020", name: "Project Materials", type: "expense", description: "Project supplies" },
    // Service-specific expenses
    { code: "6410", name: "Professional Development", type: "expense", description: "Training and education" },
    { code: "6420", name: "Professional Memberships", type: "expense", description: "Association dues" },
    { code: "6430", name: "Software Subscriptions", type: "expense", description: "SaaS tools" },
    { code: "6440", name: "Research & Reference", type: "expense", description: "Research materials" },
  ],
};

/**
 * Manufacturing Template
 */
const manufacturingTemplate: CoATemplate = {
  id: "manufacturing",
  name: "Manufacturing",
  description: "For manufacturing and production businesses",
  industry: "Manufacturing",
  accounts: [
    ...commonAccounts,
    // Inventory Assets
    { code: "1400", name: "Raw Materials", type: "asset", description: "Production materials" },
    { code: "1410", name: "Work in Progress", type: "asset", description: "Partially completed goods" },
    { code: "1420", name: "Finished Goods", type: "asset", description: "Completed inventory" },
    { code: "1430", name: "Supplies Inventory", type: "asset", description: "Production supplies" },
    // Fixed Assets
    { code: "1560", name: "Machinery", type: "asset", description: "Production equipment" },
    { code: "1570", name: "Accumulated Depreciation - Machinery", type: "asset", description: "Equipment depreciation" },
    // Revenue
    { code: "4000", name: "Product Sales", type: "income", description: "Finished goods sales" },
    { code: "4010", name: "Custom Orders", type: "income", description: "Custom manufacturing" },
    { code: "4020", name: "Scrap Sales", type: "income", description: "Scrap material revenue" },
    // Cost of Sales
    { code: "5000", name: "Raw Materials Used", type: "expense", description: "Material costs" },
    { code: "5010", name: "Direct Labor", type: "expense", description: "Production wages" },
    { code: "5020", name: "Manufacturing Overhead", type: "expense", description: "Factory overhead" },
    { code: "5030", name: "Quality Control", type: "expense", description: "QC costs" },
    { code: "5040", name: "Equipment Maintenance", type: "expense", description: "Machine maintenance" },
    // Manufacturing expenses
    { code: "6130", name: "Factory Utilities", type: "expense", description: "Production utilities" },
    { code: "6710", name: "Equipment Depreciation", type: "expense", description: "Machinery depreciation" },
  ],
};

/**
 * Restaurant/Food Service Template
 */
const restaurantTemplate: CoATemplate = {
  id: "restaurant",
  name: "Restaurant & Food Service",
  description: "For restaurants, cafes, and food service businesses",
  industry: "Food Service",
  accounts: [
    ...commonAccounts,
    // Inventory Assets
    { code: "1400", name: "Food Inventory", type: "asset", description: "Food ingredients" },
    { code: "1410", name: "Beverage Inventory", type: "asset", description: "Drink inventory" },
    { code: "1420", name: "Supplies Inventory", type: "asset", description: "Disposables and supplies" },
    // Fixed Assets
    { code: "1560", name: "Kitchen Equipment", type: "asset", description: "Cooking equipment" },
    { code: "1570", name: "Accumulated Depreciation - Kitchen", type: "asset", description: "Kitchen depreciation" },
    // Revenue
    { code: "4000", name: "Food Sales", type: "income", description: "Food revenue" },
    { code: "4010", name: "Beverage Sales", type: "income", description: "Drink revenue" },
    { code: "4020", name: "Catering Revenue", type: "income", description: "Catering services" },
    { code: "4030", name: "Delivery Revenue", type: "income", description: "Delivery fees" },
    { code: "4040", name: "Gift Card Sales", type: "income", description: "Gift card revenue" },
    // Cost of Sales
    { code: "5000", name: "Food Cost", type: "expense", description: "Food ingredients cost" },
    { code: "5010", name: "Beverage Cost", type: "expense", description: "Drink cost" },
    { code: "5020", name: "Packaging & Supplies", type: "expense", description: "Takeout supplies" },
    // Restaurant expenses
    { code: "6530", name: "Credit Card Processing", type: "expense", description: "Payment fees" },
    { code: "6540", name: "POS System Fees", type: "expense", description: "Point of sale costs" },
    { code: "6550", name: "Delivery App Fees", type: "expense", description: "Third-party delivery" },
    { code: "6560", name: "Linen & Laundry", type: "expense", description: "Laundry service" },
    { code: "6570", name: "Menu Printing", type: "expense", description: "Menu materials" },
  ],
};

/**
 * Construction Template
 */
const constructionTemplate: CoATemplate = {
  id: "construction",
  name: "Construction",
  description: "For general contractors and construction companies",
  industry: "Construction",
  accounts: [
    ...commonAccounts,
    // Construction-specific assets
    { code: "1400", name: "Job Materials", type: "asset", description: "Materials on hand" },
    { code: "1410", name: "Work in Progress", type: "asset", description: "Costs on open jobs" },
    { code: "1420", name: "Retainage Receivable", type: "asset", description: "Withheld payments" },
    // Fixed Assets
    { code: "1560", name: "Construction Equipment", type: "asset", description: "Heavy equipment" },
    { code: "1570", name: "Accumulated Depreciation - Equipment", type: "asset", description: "Equipment depreciation" },
    { code: "1580", name: "Tools", type: "asset", description: "Small tools" },
    // Liabilities
    { code: "2310", name: "Retainage Payable", type: "liability", description: "Retainage to subs" },
    // Revenue
    { code: "4000", name: "Contract Revenue", type: "income", description: "Construction contracts" },
    { code: "4010", name: "Change Order Revenue", type: "income", description: "Change orders" },
    { code: "4020", name: "T&M Revenue", type: "income", description: "Time and materials" },
    // Cost of Sales
    { code: "5000", name: "Job Materials", type: "expense", description: "Direct materials" },
    { code: "5010", name: "Job Labor", type: "expense", description: "Direct labor" },
    { code: "5020", name: "Subcontractor Costs", type: "expense", description: "Subcontractor fees" },
    { code: "5030", name: "Equipment Rental", type: "expense", description: "Rented equipment" },
    { code: "5040", name: "Permits & Fees", type: "expense", description: "Building permits" },
    { code: "5050", name: "Job Site Expenses", type: "expense", description: "Site-related costs" },
    // Construction expenses
    { code: "6310", name: "Bonding & Liability Insurance", type: "expense", description: "Contractor insurance" },
    { code: "6320", name: "Workers Compensation", type: "expense", description: "Worker's comp" },
    { code: "6430", name: "Estimating Software", type: "expense", description: "Bidding software" },
  ],
};

/**
 * All available templates
 */
export const coaTemplates: CoATemplate[] = [
  generalTemplate,
  retailTemplate,
  servicesTemplate,
  manufacturingTemplate,
  restaurantTemplate,
  constructionTemplate,
];

/**
 * Get template by ID
 */
export function getCoATemplate(templateId: string): CoATemplate | undefined {
  return coaTemplates.find((t) => t.id === templateId);
}

/**
 * Get template list (without full account details for listing)
 */
export function getCoATemplateList(): Array<{
  id: string;
  name: string;
  description: string;
  industry: string;
  accountCount: number;
}> {
  return coaTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    industry: t.industry,
    accountCount: t.accounts.length,
  }));
}
