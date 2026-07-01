# Mini E-Commerce Platform

Full-stack e-commerce platform (customer storefront + admin panel) built for the Full-Stack Developer Assessment.

> **Status:** Phase 0 (scaffold) complete. This README will be filled in incrementally as each phase lands — see `NOTES.md` for the running log of decisions and agent-workflow notes.

## Tech Stack

- **Backend:** NestJS + Mongoose (MongoDB)
- **Frontend:** Next.js (App Router) + Tailwind CSS
- **Database:** MongoDB, run locally as a single-node replica set via Docker Compose (required for multi-document transactions used at checkout)
- **Auth:** JWT (access + refresh tokens), bcrypt password hashing
- **Payments:** Stripe test mode (or a clearly-labeled mock, see NOTES.md)

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
   npm run start:dev
   ```
   Runs on `http://localhost:4000`, API prefixed with `/api` (health check: `GET /api/health`).

3. **Frontend:**
   ```bash
   cd frontend
   cp .env.local.example .env.local
   npm install
   npm run dev
   ```
   Runs on `http://localhost:3000`.

## Seeded credentials

_Not yet available — added in Phase 1 (seed script)._

## Running tests

```bash
cd backend
npm run test      # unit tests
npm run test:e2e  # e2e tests (requires MongoDB running)
```

## Project structure

```
/backend   - NestJS API (modular: auth, users, products, categories, cart, orders, admin, recommendations)
/frontend  - Next.js storefront + admin panel
docker-compose.yml - MongoDB single-node replica set
```
