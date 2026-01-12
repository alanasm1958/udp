```mermaid
graph TD
    A[Business Profile Created/Updated] --> B{AI Analysis}
    B --> C[Identify Applicable Requirements]
    C --> D[Create Requirements with Closure Criteria]
    D --> E[Generate Linked Tasks]
    D --> F[Generate Linked Alerts]
    
    E --> G[User Completes Tasks]
    F --> G
    
    G --> H[Upload Documents]
    G --> I[Provide Information]
    
    H --> J{AI Document Analysis}
    J --> K[Extract Structured Data]
    K --> L[Update Evidence]
    I --> L
    
    L --> M{Deterministic Closure Check}
    
    M --> N{All Criteria Met?}
    N -->|YES| O[Mark Requirement SATISFIED]
    N -->|NO| P[Requirement Remains UNSATISFIED]
    
    O --> Q[Auto-Close All Linked Tasks]
    O --> R[Auto-Resolve All Linked Alerts]
    O --> S[Log Audit Entry]
    
    Q --> T[Dashboard Updated]
    R --> T
    S --> T
    
    P --> U[Tasks Remain Open]
    P --> V[Alerts Remain Active]
    
    style A fill:#4a90e2
    style O fill:#7cb342
    style P fill:#f44336
    style M fill:#ff9800
    style B fill:#9c27b0
    style J fill:#9c27b0
    style Q fill:#7cb342
    style R fill:#7cb342
```

# GRC System Architecture

## Component Relationships

```mermaid
graph LR
    A[Business Profile] --> B[Requirements]
    B --> C[Tasks]
    B --> D[Alerts]
    B --> E[Documents]
    
    C -.->|Linked to| B
    D -.->|Linked to| B
    E -.->|Evidence for| B
    
    F[Tax Filings] -.->|References| B
    G[Licenses] -.->|References| B
    H[Calendar Events] -.->|Based on| B
    
    I[Audit Log] -.->|Tracks changes to| B
    I -.->|Tracks changes to| C
    I -.->|Tracks changes to| D
    
    style B fill:#4a90e2,stroke:#333,stroke-width:4px
    style C fill:#ff9800
    style D fill:#f44336
    style E fill:#7cb342
```

## Closure Logic Flow

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Route
    participant DB as Database
    participant AI as AI Service
    participant SYS as System

    U->>API: Upload Document
    API->>AI: Analyze Document
    AI-->>API: Extracted Data
    API->>DB: Save Document + Link to Requirement
    API->>DB: Update requirement.evidenceData
    
    Note over DB: TRIGGER FIRED
    
    DB->>SYS: evaluate_requirement_closure()
    SYS->>DB: Get Closure Criteria
    SYS->>DB: Get Current Evidence
    
    alt All Criteria Met
        SYS->>DB: SET requirement.status = 'satisfied'
        SYS->>DB: SET tasks.status = 'completed' WHERE requirement_id
        SYS->>DB: SET alerts.status = 'resolved' WHERE requirement_id
        SYS->>DB: INSERT audit_log
        SYS-->>U: ✅ Requirement Satisfied!
    else Criteria Not Met
        SYS-->>U: ⚠️ Still Missing: X, Y, Z
    end
```

## Analytics Calculation

```mermaid
graph TD
    A[All Requirements] --> B{Status}
    B -->|satisfied| C[Satisfied Count]
    B -->|unsatisfied| D[Unsatisfied Count]
    B -->|at_risk| E[At Risk Count]
    B -->|unknown| F[Unknown Count]
    
    C --> G[Calculate Compliance Score]
    D --> G
    
    A --> H{Risk Level}
    H -->|critical| I[Critical Count]
    H -->|high| J[High Count]
    H -->|medium| K[Medium Count]
    H -->|low| L[Low Count]
    
    I --> M[Calculate Risk Profile]
    J --> M
    K --> M
    L --> M
    
    A --> N{Category}
    N -->|tax| O[Tax Compliance %]
    N -->|labor| P[Labor Compliance %]
    N -->|licensing| Q[Licensing Compliance %]
    
    G --> R[Dashboard Analytics]
    M --> R
    O --> R
    P --> R
    Q --> R
    
    style G fill:#7cb342
    style M fill:#ff9800
    style R fill:#4a90e2
```

## Database Relationships

```mermaid
erDiagram
    BUSINESS_PROFILES ||--o{ GRC_REQUIREMENTS : "informs"
    GRC_REQUIREMENTS ||--o{ GRC_TASKS : "has"
    GRC_REQUIREMENTS ||--o{ GRC_ALERTS : "has"
    GRC_REQUIREMENTS ||--o{ GRC_DOCUMENT_LINKS : "has"
    GRC_REQUIREMENTS ||--o{ GRC_REQUIREMENT_EVALUATIONS : "has"
    GRC_REQUIREMENTS ||--o{ GRC_TAX_FILINGS : "references"
    GRC_REQUIREMENTS ||--o{ GRC_LICENSES : "references"
    GRC_REQUIREMENTS ||--o{ GRC_COMPLIANCE_CALENDAR : "schedules"
    
    DOCUMENTS ||--o{ GRC_DOCUMENT_LINKS : "linked via"
    USERS ||--o{ GRC_TASKS : "assigned to"
    
    GRC_REQUIREMENTS {
        uuid id PK
        uuid tenant_id FK
        string requirement_code UK
        string title
        enum category
        enum status
        enum risk_level
        jsonb closure_criteria
        jsonb evidence_data
        timestamp satisfied_at
    }
    
    GRC_TASKS {
        uuid id PK
        uuid requirement_id FK
        enum status
        boolean auto_closed
    }
    
    GRC_ALERTS {
        uuid id PK
        uuid requirement_id FK
        enum severity
        enum status
        boolean auto_resolved
    }
```

## User Journey - New Requirement

```mermaid
journey
    title User Satisfies a Compliance Requirement
    section Discovery
      View Dashboard: 5: User
      See Unsatisfied Requirement: 3: User
      Click to View Details: 5: User
    section Understanding
      Read AI Explanation: 5: User, AI
      Review Closure Criteria: 4: User
      See Linked Tasks: 5: User
    section Action
      Complete Task 1: 4: User
      Upload Document: 4: User
      AI Extracts Data: 5: AI
      Complete Task 2: 4: User
      Provide Information: 4: User
    section Resolution
      System Evaluates: 5: System
      Criteria Met: 5: System
      Tasks Auto-Close: 5: System
      Alerts Resolve: 5: System
      Dashboard Updates: 5: User
      User Sees Success: 5: User
```

## Page Navigation Flow

```mermaid
graph TD
    A[GRC Dashboard] --> B[Requirements List]
    A --> C[Tasks List]
    A --> D[Alerts List]
    A --> E[Business Profile]
    A --> F[Tax History]
    A --> G[Licenses]
    A --> H[Audit Log]
    A --> I[Calendar]
    A --> J[Documents]
    
    B --> K[Requirement Detail]
    K --> L[Upload Document]
    K --> M[Edit Evidence]
    K --> N[View Tasks]
    K --> O[View Alerts]
    K --> P[View History]
    
    C --> Q[Task Detail]
    Q --> R[Mark Complete]
    Q --> S[Upload Evidence]
    
    D --> K
    
    F --> T[Tax Filing Detail]
    G --> U[License Detail]
    
    style A fill:#4a90e2,stroke:#333,stroke-width:4px
    style K fill:#ff9800
```

## API Request Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant M as Middleware
    participant A as API Route
    participant L as Business Logic
    participant D as Database
    participant AU as Audit Logger

    C->>M: Request with JWT
    M->>M: Verify Token
    M->>M: Extract Tenant Context
    M->>A: Forward with Headers
    
    A->>L: Call Business Logic
    L->>D: Query/Mutation
    D-->>L: Result
    
    L->>AU: Log Action
    AU->>D: Write Audit Entry
    
    L-->>A: Return Data
    A-->>C: JSON Response
```
