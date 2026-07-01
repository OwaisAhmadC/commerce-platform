# Mini E-Commerce Platform

Full-stack e-commerce platform (customer storefront + admin panel) built for the Full-Stack Developer Assessment.

See `NOTES.md` for the full log of decisions, agent workflow, verification steps, assumptions, and trade-offs
made throughout the build.

## Features

**Storefront**
- Product catalog with pagination, search, category/price filters, and sort (price/newest)
- Product detail page with "Customers also bought" recommendations
- Cart (add/update/remove, server-enforced stock limits, persists per user)
- Checkout via real Stripe Checkout Sessions (test mode)
- Order history with per-order detail
- Signup/login with JWT access + refresh tokens
- Personalized "Recommended for you" (or "Trending now" for guests) on the home page

**Admin panel** (role-restricted, both client-side UI and server-side guards)
- Product CRUD
- Order management with status lifecycle (`pending → processing → shipped → delivered`, plus `cancelled`)
- Dashboard: total sales, order count by status (chart), top-selling products

## Tech Stack

- **Backend:** NestJS + Mongoose (MongoDB)
- **Frontend:** Next.js (App Router) + Tailwind CSS + recharts
- **Database:** MongoDB, run locally as a single-node replica set via Docker Compose (required for the
  multi-document transactions used at checkout and order-status updates)
- **Auth:** JWT (access + refresh tokens), bcrypt password hashing
- **Payments:** Stripe Checkout Sessions, test mode (see below for how to fully enable it)

## Prerequisites

- Node.js 20+
- Docker Desktop (for MongoDB)
- npm

## Setup

1. **Start MongoDB** (single-node replica set, required for transactions):
   ```bash
   docker compose up -d
   ```
   This starts MongoDB on `localhost:27017` and auto-initiates a replica set named `rs0`.
   You can connect with MongoDB Compass using `mongodb://localhost:27017/?replicaSet=rs0`.

2. **Backend:**
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm run seed        # populates categories/products/admin+customer users
   npm run start:dev
   ```
   Runs on `http://localhost:4000`, API prefixed with `/api` (health check: `GET /api/health`).

   **Interactive API docs (Swagger/OpenAPI):** `http://localhost:4000/docs` — every endpoint grouped by resource,
   with request/response schemas generated from the actual DTOs. To test protected routes: call `POST
   /api/auth/login` (or `/signup`) via the docs, copy the returned `accessToken`, click **Authorize** at the top
   and paste it in, then any endpoint's "Try it out" will send it as a Bearer token automatically.

3. **Frontend:**
   ```bash
   cd frontend
   cp .env.local.example .env.local
   npm install
   npm run dev
   ```
   Runs on `http://localhost:3000`.

## Environment variables

**`backend/.env`** (see `backend/.env.example`):

| Variable | Purpose |
|---|---|
| `PORT` | Backend port (default 4000) |
| `MONGODB_URI` | Mongo connection string — must include `replicaSet=rs0` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets for the two token types (keep these different) |
| `JWT_ACCESS_EXPIRES` / `JWT_REFRESH_EXPIRES` | Token lifetimes (e.g. `15m`, `7d`) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe test-mode credentials — see below |
| `FRONTEND_URL` | Used for CORS and Stripe redirect URLs |

**`frontend/.env.local`** (see `frontend/.env.local.example`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL the frontend calls (default `http://localhost:4000/api`) |

## Seeded credentials

`npm run seed` (run from `/backend`) clears and repopulates `users`, `categories`, `products`, `carts`, and
`orders`, then prints credentials to the console:

| Role     | Email               | Password      |
|----------|---------------------|---------------|
| Admin    | admin@example.com   | Admin123!     |
| Customer | customer@example.com| Customer123!  |

## Payments (Stripe test mode, with an automatic mock fallback)

Checkout uses real Stripe Checkout Sessions in test mode when configured. To fully exercise the real flow:

1. A free Stripe account and its **test mode** secret key (`sk_test_...`) — set `STRIPE_SECRET_KEY` in `backend/.env`.
2. The [Stripe CLI](https://docs.stripe.com/stripe-cli) forwarding webhooks to the backend during local dev:
   ```bash
   stripe listen --forward-to localhost:4000/api/checkout/webhook
   ```
   This prints a webhook signing secret (`whsec_...`) — set it as `STRIPE_WEBHOOK_SECRET` in `backend/.env`.

**Without real keys** (the default, using `backend/.env.example`'s placeholder values), clicking "Pay with card"
still works end-to-end: the backend catches the Stripe API failure and automatically completes the order via a
clearly-labeled mock payment — same atomic stock-decrement/cart-clear transaction a real webhook would trigger,
just skipping the Stripe-hosted page. The confirmation page shows an explicit "Test mode" banner in this case so
it's never mistaken for a real charge. The moment real keys are added, this fallback stops triggering and the
real Stripe flow takes over automatically — no code changes needed. See `NOTES.md` (Phase 5 and the post-submission
addendum) for how both the real webhook path and the mock fallback are tested without needing live Stripe access.

## Running tests

```bash
cd backend
npm run test      # unit tests
npm run test:e2e  # e2e tests (requires MongoDB running)
```

25 automated tests across 4 suites: auth (signup/login edge cases), health check, the checkout webhook's atomic
transaction (happy path, idempotency, insufficient-stock rollback, session expiry), cart stock enforcement, and
the admin order-status lifecycle (valid/invalid transitions, stock decrement/restore).

## Linting

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

Both projects lint clean. See `NOTES.md` (Phase 8) for the one deliberately-disabled frontend rule and why.

## Project structure

```
/backend   - NestJS API (modular: auth, users, products, categories, cart, orders, checkout, admin, recommendations)
/frontend  - Next.js storefront + admin panel
docker-compose.yml - MongoDB single-node replica set
```
