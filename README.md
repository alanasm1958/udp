# UDP - Unified Data Platform

A modern ERP/accounting platform built with Next.js 15, featuring a liquid glass UI and comprehensive business functionality.

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Docker (optional, for containerized Postgres)

### Environment Variables

Create a `.env.local` file:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/udp_dev"

# Authentication
AUTH_SECRET="your-secret-key-min-32-chars"  # Required in production
```

### Development Setup

```bash
# Install dependencies
npm install

# Start Postgres (if using Docker)
docker compose up -d

# Run migrations
npm run db:migrate:dev

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the application.

## Authentication

### Bootstrap (Development Only)

In development mode, bootstrap creates an admin user:

```bash
curl -X POST http://localhost:3000/api/auth/bootstrap
```

This creates:
- **Email:** `admin@local`
- **Password:** `admin1234`
- **Role:** `admin` (full access to all features)

### Login

Navigate to `/login` or call:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local","password":"admin1234"}'
```

Session is stored in an HttpOnly cookie (`udp_session`).

### Roles

| Role | Access |
|------|--------|
| `admin` | Full access to all features |
| `finance` | Financial posting, payments, AR/AP |
| `sales` | Sales documents, fulfillment |
| `procurement` | Purchase documents, receiving |
| `inventory` | Inventory management |

### RBAC-Protected Endpoints

State-changing operations require specific roles:

- `/api/sales/docs/[id]/post` - admin, finance, sales
- `/api/sales/docs/[id]/fulfill` - admin, sales
- `/api/procurement/docs/[id]/post` - admin, finance, procurement
- `/api/procurement/docs/[id]/receive` - admin, procurement
- `/api/finance/payments/[id]/post` - admin, finance
- `/api/finance/payments/[id]/void` - admin, finance
- `/api/finance/payments/[id]/allocations` - admin, finance
- `/api/finance/payments/[id]/unallocate` - admin, finance
- `/api/admin/users` - admin only

## Smoke Tests

Run layer-specific smoke tests:

```bash
# All layers
npm run guard:all

# Authentication & RBAC (requires running server)
./scripts/smoke/layer14_auth.sh

# Reports UI
./scripts/smoke/layer13_reports_ui.sh
```

## Project Structure

```
src/
  app/                    # Next.js App Router
    (app)/               # Authenticated app pages
      dashboard/         # Dashboard
      admin/users/       # User management (admin only)
      finance/           # Financial reports
      sales/             # Sales documents
      procurement/       # Purchase documents
      inventory/         # Inventory balances
    login/               # Login page
    api/                 # API routes
      auth/              # Authentication endpoints
      admin/             # Admin-only endpoints
      sales/             # Sales APIs
      procurement/       # Procurement APIs
      finance/           # Finance APIs
      reports/           # Reporting APIs
  components/
    ui/glass.tsx         # Liquid glass UI components
    layout/shell.tsx     # App shell with navigation
  lib/
    auth.ts              # JWT session management
    authz.ts             # RBAC helpers
    password.ts          # Password hashing (PBKDF2)
    posting.ts           # Ledger posting logic
  db/
    schema.ts            # Drizzle ORM schema
```

## License

Proprietary - All rights reserved.
