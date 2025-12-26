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

# Billing (optional - Stripe integration)
STRIPE_SECRET_KEY="sk_test_..."             # Stripe secret key
STRIPE_WEBHOOK_SECRET="whsec_..."           # Stripe webhook secret
STRIPE_PRICE_STARTER="price_..."            # Stripe price ID for starter plan
STRIPE_PRICE_PRO="price_..."                # Stripe price ID for pro plan
NEXT_PUBLIC_APP_URL="http://localhost:3000" # App URL for Stripe redirects

# Dev billing mode (set to skip Stripe)
BILLING_PROVIDER="dev"                      # Use "dev" to enable dev fallback
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
- `/api/admin/tenant` - admin only
- `/settings/*` pages - admin only

### Single-Tenant Security

Each user belongs to exactly one tenant. The tenant context is:
- Derived exclusively from the authenticated session (JWT)
- **Never** accepted from request headers (x-tenant-id is overwritten by middleware)
- Enforced at the database level with NOT NULL constraints

### Admin Settings

Admin users can access:
- `/settings` - Settings landing page
- `/settings/tenant` - Tenant info, subscription status
- `/settings/users` - User management (create, activate/deactivate, roles)

## Billing & Subscriptions

Subscription plans gate access to features based on plan tier.

### Plans

| Plan | Price | Capabilities |
|------|-------|--------------|
| `free` | $0 | Dashboard, Basic Reports |
| `starter` | $29/mo | + Sales, Procurement, Inventory |
| `pro` | $99/mo | + Finance, Payments, AR/AP |

### Billing APIs

- `GET /api/billing/plans` - List available plans
- `GET /api/billing/status` - Current subscription status
- `POST /api/billing/checkout` - Create checkout session
- `POST /api/billing/portal` - Open Stripe billing portal
- `POST /api/billing/webhook` - Stripe webhook handler

### Dev Billing Mode

Without Stripe keys, billing operates in dev mode:
- Checkout directly activates the selected plan
- 30-day subscription period
- No actual payment processing

Bootstrap creates a `pro` subscription for the dev tenant.

### Capability Enforcement

Middleware checks subscription status and plan capabilities:
- Pages redirect to `/billing` if no active subscription
- APIs return `402 Payment Required` for subscription issues
- APIs return `403 Forbidden` with `capability` field for plan limits

## Smoke Tests

Run layer-specific smoke tests:

```bash
# All layers
npm run guard:all

# Authentication & RBAC (requires running server)
./scripts/smoke/layer14_auth.sh

# Billing & Subscriptions
./scripts/smoke/layer15_billing.sh

# Tenant & Admin Settings
./scripts/smoke/layer16_tenant_rbac.sh

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
      settings/          # Admin settings
        tenant/          # Tenant info & subscription
        users/           # User management
      finance/           # Financial reports
      sales/             # Sales documents
      procurement/       # Purchase documents
      inventory/         # Inventory balances
    billing/             # Subscription management
    login/               # Login page
    onboarding/          # Account setup (edge case)
    api/                 # API routes
      auth/              # Authentication endpoints
      admin/             # Admin-only endpoints
        tenant/          # Tenant info API
        users/           # User management API
      billing/           # Billing & subscription APIs
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
    audit.ts             # Audit logging
    entitlements.ts      # Subscription & plan capabilities
    password.ts          # Password hashing (PBKDF2)
    posting.ts           # Ledger posting logic
  db/
    schema.ts            # Drizzle ORM schema
```

## License

Proprietary - All rights reserved.
