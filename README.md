# UDP - Unified Data Platform

A modern multi-tenant ERP platform built with Next.js 16, React 19, Drizzle ORM, PostgreSQL, and Tailwind CSS.

## Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- Docker (optional, for containerized Postgres)

### Environment Variables

Create a `.env.local` file:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/udp_dev"

# Authentication
AUTH_SECRET="your-secret-key-min-32-chars"

# Billing (optional - Stripe integration)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_STARTER="price_..."
STRIPE_PRICE_PRO="price_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Dev billing mode (set to skip Stripe)
BILLING_PROVIDER="dev"
```

### Development Setup

```bash
npm install
docker compose up -d          # Start Postgres (if using Docker)
npm run db:migrate:dev        # Run migrations
npm run dev                   # Start dev server
```

Open [http://localhost:3000](http://localhost:3000).

### Bootstrap (Development Only)

```bash
curl -X POST http://localhost:3000/api/auth/bootstrap
```

Creates admin user: `admin@local` / `admin1234` with full access.

## Testing

```bash
# All smoke tests
npm run guard:all

# Individual layers (requires running server)
./scripts/smoke/layer14_auth.sh
./scripts/smoke/layer15_billing.sh
./scripts/smoke/layer16_tenant_rbac.sh
```

## Documentation

- **`CLAUDE.md`** - Master reference: routes, API endpoints, database schema, workflows, UI components, architecture
- **`docs/`** - Module remodel specs:
  - `docs/DEPLOYMENT.md` - Production deployment guide
  - `docs/finance-remodel/` - Finance module spec
  - `docs/grc-remodel/` - GRC implementation guide and workflows
  - `docs/operations-remodel/` - Operations module spec
  - `docs/sales-customers-remodel-complete/` - Sales/CRM spec

## License

Proprietary - All rights reserved.
