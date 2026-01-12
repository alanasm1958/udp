# GRC Module API Routes

## Base Path: `/api/grc`

---

## 1. Analytics & Dashboard

### GET `/api/grc/analytics`
Get GRC analytics and compliance metrics

**Query Parameters:**
- None

**Response:**
```json
{
  "compliance": {
    "overallScore": 85.5,
    "satisfiedCount": 45,
    "unsatisfiedCount": 8,
    "atRiskCount": 3,
    "unknownCount": 2,
    "totalRequirements": 58
  },
  "riskProfile": {
    "critical": 2,
    "high": 5,
    "medium": 12,
    "low": 39
  },
  "upcomingDeadlines": {
    "overdue": 1,
    "thisWeek": 3,
    "thisMonth": 8,
    "nextQuarter": 15
  },
  "byCategory": {
    "tax": { "satisfied": 15, "unsatisfied": 2, "percentage": 88.2 },
    "labor": { "satisfied": 10, "unsatisfied": 3, "percentage": 76.9 },
    "licensing": { "satisfied": 12, "unsatisfied": 1, "percentage": 92.3 },
    "environmental": { "satisfied": 5, "unsatisfied": 1, "percentage": 83.3 },
    "data_privacy": { "satisfied": 3, "unsatisfied": 1, "percentage": 75.0 }
  }
}
```

---

## 2. Business Profile

### GET `/api/grc/profile`
Get current business profile

**Response:**
```json
{
  "id": "uuid",
  "legalName": "Acme Corporation",
  "tradeName": "Acme",
  "legalStructure": "LLC",
  "incorporationDate": "2020-01-15",
  "jurisdiction": "Delaware",
  "taxId": "12-3456789",
  "primaryIndustry": "Software Development",
  "naicsCodes": ["541511", "541512"],
  "businessDescription": "Enterprise software solutions",
  "annualRevenue": 5000000.00,
  "employeeCount": 45,
  "headquartersAddress": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "zip": "94102",
    "country": "USA"
  },
  "operatingLocations": [...],
  "businessActivities": ["software_development", "saas", "data_processing"],
  "licensesHeld": ["CA-BL-123456"],
  "regulatedActivities": ["data_processing", "financial_transactions"],
  "aiAnalysis": {
    "classification": "Technology Services",
    "compliance_triggers": ["data_privacy", "labor", "tax"],
    "risk_areas": ["GDPR", "CCPA", "SOX"]
  },
  "confidenceScore": 0.95,
  "lastAnalyzedAt": "2026-01-12T10:00:00Z"
}
```

### POST `/api/grc/profile`
Create or update business profile

**Request Body:**
```json
{
  "legalName": "Acme Corporation",
  "legalStructure": "LLC",
  "incorporationDate": "2020-01-15",
  "jurisdiction": "Delaware",
  "taxId": "12-3456789",
  "primaryIndustry": "Software Development",
  "annualRevenue": 5000000.00,
  "employeeCount": 45,
  "headquartersAddress": {...},
  "businessActivities": ["software_development", "saas"],
  "regulatedActivities": ["data_processing"]
}
```

### POST `/api/grc/profile/analyze`
Trigger AI analysis of business profile

**Response:**
```json
{
  "analysis": {
    "identifiedRequirements": [
      {
        "code": "CA-DATA-PRIVACY-CCPA",
        "title": "California Consumer Privacy Act Compliance",
        "rationale": "Business processes personal data of CA residents with revenue > $25M threshold",
        "confidence": 0.92
      }
    ],
    "riskAreas": ["data_privacy", "labor", "tax"],
    "recommendations": [...]
  },
  "requirementsCreated": 15,
  "tasksGenerated": 8
}
```

---

## 3. Requirements

### GET `/api/grc/requirements`
List all requirements

**Query Parameters:**
- `status`: filter by status (satisfied, unsatisfied, at_risk, unknown)
- `riskLevel`: filter by risk level (low, medium, high, critical)
- `category`: filter by category (tax, labor, licensing, etc.)
- `includeInactive`: include inactive requirements (default: false)

**Response:**
```json
{
  "requirements": [
    {
      "id": "uuid",
      "requirementCode": "CA-SALES-TAX-REG",
      "title": "California Sales Tax Registration",
      "description": "Register for sales tax permit in California",
      "category": "tax",
      "status": "unsatisfied",
      "riskLevel": "high",
      "priority": 3,
      "closureCriteria": {
        "required_documents": ["sales_tax_permit"],
        "required_fields": ["permit_number", "issue_date"]
      },
      "evidenceDocuments": [],
      "evidenceData": null,
      "aiExplanation": "Required due to physical nexus in California through warehouse location",
      "nextActionDue": "2026-02-01",
      "tasksCount": 2,
      "alertsCount": 1,
      "createdAt": "2026-01-10T08:00:00Z"
    }
  ],
  "total": 58
}
```

### GET `/api/grc/requirements/:id`
Get requirement details

**Response:**
```json
{
  "requirement": {...},
  "tasks": [...],
  "alerts": [...],
  "documents": [...],
  "evaluationHistory": [...]
}
```

### POST `/api/grc/requirements`
Create new requirement (manual)

**Request Body:**
```json
{
  "requirementCode": "CUSTOM-REQ-001",
  "title": "Custom Compliance Requirement",
  "description": "...",
  "category": "licensing",
  "riskLevel": "medium",
  "closureCriteria": {
    "required_documents": ["license_copy"],
    "required_fields": ["license_number"]
  },
  "nextActionDue": "2026-03-01"
}
```

### PATCH `/api/grc/requirements/:id`
Update requirement

**Request Body:**
```json
{
  "status": "satisfied",
  "evidenceData": {
    "permit_number": "CA-123456",
    "issue_date": "2026-01-15"
  },
  "evidenceDocuments": ["doc-uuid-1"]
}
```

### POST `/api/grc/requirements/:id/evaluate`
Trigger manual evaluation of requirement

**Response:**
```json
{
  "evaluation": {
    "previousStatus": "unsatisfied",
    "newStatus": "satisfied",
    "closureCheckPassed": true,
    "closureCheckDetails": {
      "required_documents": { "sales_tax_permit": true },
      "required_fields": { "permit_number": true, "issue_date": true }
    },
    "tasksAutoClosed": 2,
    "alertsAutoResolved": 1
  }
}
```

### DELETE `/api/grc/requirements/:id`
Deactivate requirement

---

## 4. Tasks

### GET `/api/grc/tasks`
List all tasks

**Query Parameters:**
- `status`: filter by status (open, blocked, completed)
- `assignedTo`: filter by assigned user
- `requirementId`: filter by requirement

**Response:**
```json
{
  "tasks": [
    {
      "id": "uuid",
      "requirementId": "req-uuid",
      "requirementTitle": "California Sales Tax Registration",
      "title": "Register for CA Sales Tax Permit",
      "description": "Complete online registration at CDTFA website",
      "actionType": "register",
      "status": "open",
      "assignedTo": "user-uuid",
      "assignedToName": "John Doe",
      "dueDate": "2026-02-01",
      "completionEvidence": null,
      "uploadedDocuments": [],
      "createdAt": "2026-01-10T08:00:00Z"
    }
  ],
  "total": 15
}
```

### POST `/api/grc/tasks`
Create new task (manual)

**Request Body:**
```json
{
  "requirementId": "req-uuid",
  "title": "Complete renewal application",
  "description": "...",
  "actionType": "renew",
  "assignedTo": "user-uuid",
  "dueDate": "2026-03-01"
}
```

### PATCH `/api/grc/tasks/:id`
Update task

**Request Body:**
```json
{
  "status": "completed",
  "completionEvidence": {
    "completionDate": "2026-01-15",
    "notes": "Registered successfully, permit number received"
  },
  "uploadedDocuments": ["doc-uuid"],
  "userFeedback": "Process was straightforward"
}
```

### DELETE `/api/grc/tasks/:id`
Delete task

---

## 5. Alerts

### GET `/api/grc/alerts`
List all alerts

**Query Parameters:**
- `status`: filter by status (active, resolved)
- `severity`: filter by severity (info, warning, critical)
- `requirementId`: filter by requirement

**Response:**
```json
{
  "alerts": [
    {
      "id": "uuid",
      "requirementId": "req-uuid",
      "requirementTitle": "California Sales Tax Registration",
      "title": "Registration Deadline Approaching",
      "message": "CA Sales Tax registration due in 7 days",
      "alertType": "deadline_approaching",
      "severity": "warning",
      "status": "active",
      "createdAt": "2026-01-05T08:00:00Z"
    }
  ],
  "total": 8
}
```

### PATCH `/api/grc/alerts/:id/dismiss`
Manually dismiss an alert (not recommended - should resolve via requirement)

---

## 6. Documents

### POST `/api/grc/requirements/:id/documents`
Upload document for requirement

**Request:** Multipart form data
- `file`: document file
- `documentType`: type classification
- `validityStart`: optional validity start date
- `validityEnd`: optional validity end date

**Response:**
```json
{
  "document": {
    "id": "uuid",
    "name": "sales_tax_permit.pdf",
    "documentType": "sales_tax_permit",
    "aiExtractedData": {
      "permit_number": "CA-123456",
      "issue_date": "2026-01-15",
      "expiration_date": "2027-01-15"
    },
    "aiConfidence": 0.95
  },
  "requirementUpdated": true,
  "evaluationTriggered": true
}
```

### GET `/api/grc/documents`
List all GRC documents

### DELETE `/api/grc/requirements/:id/documents/:documentId`
Remove document from requirement

---

## 7. Tax Filings

### GET `/api/grc/tax/filings`
List tax filing history

**Query Parameters:**
- `filingType`: filter by type
- `jurisdiction`: filter by jurisdiction
- `status`: filter by status
- `year`: filter by tax year

**Response:**
```json
{
  "filings": [
    {
      "id": "uuid",
      "requirementId": "req-uuid",
      "filingType": "sales_tax",
      "jurisdiction": "California",
      "taxYear": 2025,
      "taxPeriod": "Q4",
      "taxLiability": 25000.00,
      "taxPaid": 25000.00,
      "dueDate": "2026-01-31",
      "filedDate": "2026-01-28",
      "paidDate": "2026-01-28",
      "status": "paid",
      "filingDocuments": ["doc-uuid-1", "doc-uuid-2"]
    }
  ],
  "total": 24,
  "summary": {
    "totalLiability": 125000.00,
    "totalPaid": 125000.00,
    "overdueCount": 0
  }
}
```

### POST `/api/grc/tax/filings`
Record tax filing

**Request Body:**
```json
{
  "requirementId": "req-uuid",
  "filingType": "sales_tax",
  "jurisdiction": "California",
  "taxYear": 2025,
  "taxPeriod": "Q4",
  "taxLiability": 25000.00,
  "dueDate": "2026-01-31",
  "filedDate": "2026-01-28",
  "status": "filed"
}
```

### PATCH `/api/grc/tax/filings/:id`
Update tax filing

---

## 8. Licenses

### GET `/api/grc/licenses`
List all licenses and permits

**Query Parameters:**
- `status`: filter by status
- `expiring`: filter by expiration (e.g., "30" for next 30 days)

**Response:**
```json
{
  "licenses": [
    {
      "id": "uuid",
      "requirementId": "req-uuid",
      "licenseType": "business_license",
      "licenseNumber": "BL-2025-123456",
      "issuingAuthority": "City of San Francisco",
      "jurisdiction": "San Francisco, CA",
      "issueDate": "2025-01-01",
      "expirationDate": "2026-12-31",
      "renewalFrequency": "annual",
      "status": "active",
      "licenseDocuments": ["doc-uuid"],
      "daysUntilExpiration": 354
    }
  ],
  "total": 8,
  "expiringCount": 2
}
```

### POST `/api/grc/licenses`
Record new license

### PATCH `/api/grc/licenses/:id`
Update license

---

## 9. Compliance Calendar

### GET `/api/grc/calendar`
Get compliance calendar events

**Query Parameters:**
- `from`: start date (ISO format)
- `to`: end date (ISO format)
- `eventType`: filter by event type

**Response:**
```json
{
  "events": [
    {
      "id": "uuid",
      "requirementId": "req-uuid",
      "eventType": "filing_due",
      "title": "Q1 Sales Tax Filing Due",
      "description": "California sales tax for Q1 2026",
      "dueDate": "2026-04-30",
      "reminderDate": "2026-04-15",
      "status": "upcoming",
      "isRecurring": true,
      "recurrencePattern": "quarterly"
    }
  ]
}
```

---

## 10. Audit History

### GET `/api/grc/audit`
Get audit log

**Query Parameters:**
- `entityType`: filter by entity type
- `entityId`: filter by entity ID
- `eventType`: filter by event type
- `from`: start date
- `to`: end date

**Response:**
```json
{
  "entries": [
    {
      "id": "uuid",
      "eventType": "requirement_status_changed",
      "entityType": "requirement",
      "entityId": "req-uuid",
      "oldValues": { "status": "unsatisfied" },
      "newValues": { "status": "satisfied" },
      "actorId": "user-uuid",
      "actorType": "user",
      "actorName": "John Doe",
      "reason": "Evidence provided and verified",
      "occurredAt": "2026-01-15T14:30:00Z",
      "ipAddress": "192.168.1.1"
    }
  ],
  "total": 342
}
```

---

## 11. AI Operations

### POST `/api/grc/ai/analyze-document`
AI analysis of uploaded document

**Request Body:**
```json
{
  "documentId": "doc-uuid",
  "context": {
    "requirementId": "req-uuid",
    "expectedType": "sales_tax_permit"
  }
}
```

**Response:**
```json
{
  "extractedData": {
    "permit_number": "CA-123456",
    "issue_date": "2026-01-15",
    "expiration_date": "2027-01-15",
    "issuing_authority": "California Department of Tax and Fee Administration"
  },
  "documentType": "sales_tax_permit",
  "confidence": 0.95,
  "recommendations": [
    "Update requirement with extracted permit number",
    "Set expiration reminder for 30 days before 2027-01-15"
  ]
}
```

### POST `/api/grc/ai/recommend-requirements`
Get AI recommendations for new requirements based on profile changes

**Request Body:**
```json
{
  "profileChanges": {
    "employeeCount": 50,
    "newLocations": ["TX"]
  }
}
```

**Response:**
```json
{
  "recommendations": [
    {
      "code": "TX-SALES-TAX-REG",
      "title": "Texas Sales Tax Registration",
      "rationale": "New operating location in Texas triggers nexus",
      "priority": "high",
      "confidence": 0.88
    }
  ]
}
```

---

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

**Common Error Codes:**
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)
- `REQUIREMENT_NOT_SATISFIED` (422)
- `INTERNAL_ERROR` (500)

---

## Webhooks (Future)

### POST `/api/grc/webhooks/stripe`
Handle Stripe webhook events for compliance-related payments

### POST `/api/grc/webhooks/document-processed`
Handle document processing completion from AI service
