/**
 * CSV Parser for Bank Statements
 *
 * Supports multiple bank formats and auto-detection
 */

export interface BankStatementLine {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: "debit" | "credit";
  reference?: string;
}

type BankFormat = "generic" | "chase" | "bofa" | "wells";

interface ColumnMapping {
  dateCol: number;
  descriptionCol: number;
  amountCol?: number; // Optional if using separate debit/credit columns
  debitCol?: number;
  creditCol?: number;
  referenceCol?: number;
  dateFormat: "MDY" | "DMY" | "YMD";
}

const FORMAT_MAPPINGS: Record<BankFormat, ColumnMapping> = {
  generic: {
    dateCol: 0,
    descriptionCol: 1,
    amountCol: 2,
    dateFormat: "YMD",
  },
  chase: {
    dateCol: 0,
    descriptionCol: 2,
    amountCol: 3,
    dateFormat: "MDY",
  },
  bofa: {
    dateCol: 0,
    descriptionCol: 1,
    debitCol: 2,
    creditCol: 3,
    dateFormat: "MDY",
  },
  wells: {
    dateCol: 0,
    descriptionCol: 4,
    amountCol: 1,
    dateFormat: "MDY",
  },
};

/**
 * Parse a bank CSV file content into statement lines
 */
export function parseBankCSV(
  content: string,
  format?: BankFormat | string
): BankStatementLine[] {
  const lines = content.trim().split(/\r?\n/);

  if (lines.length < 2) {
    throw new Error("CSV must have at least a header and one data row");
  }

  // Skip header row
  const dataRows = lines.slice(1);

  // Detect format if not specified
  const detectedFormat = format as BankFormat || detectFormat(lines[0]);
  const mapping = FORMAT_MAPPINGS[detectedFormat] || FORMAT_MAPPINGS.generic;

  const results: BankStatementLine[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row.trim()) continue;

    const cells = parseCSVRow(row);

    try {
      const line = parseRow(cells, mapping, i + 2); // +2 for 1-indexed and header
      if (line) {
        results.push(line);
      }
    } catch (err) {
      // Skip invalid rows but continue processing
      console.warn(`Skipping row ${i + 2}: ${err instanceof Error ? err.message : "Invalid"}`);
    }
  }

  return results;
}

/**
 * Parse a single CSV row considering quoted fields
 */
function parseCSVRow(row: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote mode
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

/**
 * Detect bank format from header row
 */
function detectFormat(header: string): BankFormat {
  const headerLower = header.toLowerCase();

  if (headerLower.includes("chase")) {
    return "chase";
  }
  if (headerLower.includes("bank of america") || headerLower.includes("bofa")) {
    return "bofa";
  }
  if (headerLower.includes("wells fargo")) {
    return "wells";
  }

  // Check column patterns
  const cells = parseCSVRow(header);
  const headerPattern = cells.map((c) => c.toLowerCase()).join("|");

  if (headerPattern.includes("posting date") && headerPattern.includes("details")) {
    return "chase";
  }
  if (headerPattern.includes("date") && headerPattern.includes("debit") && headerPattern.includes("credit")) {
    return "bofa";
  }

  return "generic";
}

/**
 * Parse a row into a BankStatementLine
 */
function parseRow(
  cells: string[],
  mapping: ColumnMapping,
  rowNum: number
): BankStatementLine | null {
  // Get date
  const rawDate = cells[mapping.dateCol];
  if (!rawDate) {
    return null; // Skip rows without dates
  }

  const date = parseDate(rawDate, mapping.dateFormat);
  if (!date) {
    throw new Error(`Invalid date format: ${rawDate}`);
  }

  // Get description
  const description = cells[mapping.descriptionCol] || `Row ${rowNum}`;

  // Get amount
  let amount: number;
  let type: "debit" | "credit";

  if (mapping.debitCol !== undefined && mapping.creditCol !== undefined) {
    // Separate debit/credit columns
    const debitStr = cells[mapping.debitCol]?.replace(/[$,]/g, "");
    const creditStr = cells[mapping.creditCol]?.replace(/[$,]/g, "");

    const debit = parseFloat(debitStr) || 0;
    const credit = parseFloat(creditStr) || 0;

    if (credit > 0) {
      amount = credit;
      type = "credit";
    } else if (debit > 0) {
      amount = debit;
      type = "debit";
    } else {
      return null; // No amount
    }
  } else if (mapping.amountCol !== undefined) {
    // Single amount column
    const amountStr = cells[mapping.amountCol]?.replace(/[$,]/g, "");
    amount = parseFloat(amountStr);

    if (isNaN(amount) || amount === 0) {
      return null;
    }

    // Positive = credit (money in), Negative = debit (money out)
    if (amount > 0) {
      type = "credit";
    } else {
      type = "debit";
      amount = Math.abs(amount);
    }
  } else {
    // No amount column defined
    return null;
  }

  // Get reference if available
  const reference = mapping.referenceCol !== undefined
    ? cells[mapping.referenceCol] || undefined
    : undefined;

  return {
    date,
    description,
    amount,
    type,
    reference,
  };
}

/**
 * Parse date string to YYYY-MM-DD format
 */
function parseDate(dateStr: string, format: "MDY" | "DMY" | "YMD"): string | null {
  // Clean the date string
  const cleaned = dateStr.trim().replace(/['"]/g, "");

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try common US format (MM/DD/YYYY)
  const usMatch = cleaned.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (usMatch) {
    const [, month, day, rawYear] = usMatch;
    let year = rawYear;
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try other formats based on specified format
  const parts = cleaned.split(/[-/.]/);
  if (parts.length === 3) {
    let year: string, month: string, day: string;

    switch (format) {
      case "MDY":
        [month, day, year] = parts;
        break;
      case "DMY":
        [day, month, year] = parts;
        break;
      case "YMD":
      default:
        [year, month, day] = parts;
        break;
    }

    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
    }

    const y = parseInt(year);
    const m = parseInt(month);
    const d = parseInt(day);

    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Generate sample CSV content for testing
 */
export function generateSampleCSV(): string {
  return `Date,Description,Amount,Reference
2024-01-15,Deposit from client,1500.00,DEP001
2024-01-16,Office supplies,-125.50,CHK1001
2024-01-17,Monthly subscription,-49.99,ACH002
2024-01-18,Customer payment,2000.00,DEP002
2024-01-19,Utility bill,-189.00,ACH003
2024-01-20,Rent payment,-1500.00,CHK1002`;
}
