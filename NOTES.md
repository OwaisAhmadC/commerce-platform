# NOTES.md

Running log of decisions, agent workflow, and verification — updated incrementally per phase, not at the end.

## Agent workflow

- Driven with Claude Code using a project `CLAUDE.md` (tech stack, architecture, data model, conventions) plus
  a set of phased prompts (Phase 0 → Phase 8), fed one at a time. Each phase is reviewed and committed before
  moving to the next, rather than one large generation pass.

## Phase 0 — Scaffold

**What was built:**
- `/backend`: NestJS app (Nest CLI), added `@nestjs/mongoose`, `mongoose`, `@nestjs/config`, `class-validator`,
  `class-transformer`, `@nestjs/jwt`, `@nestjs/passport`, `passport`, `passport-jwt`, `bcrypt`, `stripe` up front
  (installed once now rather than piecemeal per phase, since they're all known dependencies from CLAUDE.md).
  `AppModule` wires `ConfigModule` (global) + `MongooseModule.forRootAsync` off `MONGODB_URI`. Replaced the
  default "Hello World" route with a real `GET /api/health` endpoint that reports Mongo connection state
  (`connection.readyState`), backed by a service that injects the Mongoose `Connection` — this is a genuine
  health check, not a static string.
- `/frontend`: Next.js 16 (App Router, Turbopack, TypeScript, Tailwind). Home page is a temporary client-side
  health-check display (fetches `NEXT_PUBLIC_API_URL/health`) — this is scaffolding only, **not** the real
  storefront UI; the actual UI/UX will be produced via a design agent per the assessment's design requirement.
- `docker-compose.yml` at repo root: `mongo:7` single-node replica set (`--replSet rs0`), with a healthcheck
  that self-initiates `rs.initiate(...)` on first run. Replica set member is advertised as `localhost:27017`
  (not the container hostname `mongo`) so that both the locally-running backend and MongoDB Compass on the host
  can connect directly without needing extra DNS/hosts entries.
- `.env.example` (backend) and `.env.local.example` (frontend) committed; real `.env`/`.env.local` are
  gitignored and were populated locally from the examples.

**Verification performed (not just "it compiled"):**
- `docker compose up -d` → confirmed container health status reaches `healthy` and `rs.status().ok` returns `1`.
- Started backend (`npm run start:dev`), curled `GET /api/health` → returned
  `{"status":"ok","mongo":"connected", ...}`, confirming a real DB connection, not a mocked one.
- Started frontend (`npm run dev`), confirmed HTTP 200 and that the page's initial render contains the expected
  "Checking backend health..." state (client-side fetch then hydrates against the confirmed-working endpoint).
- Ran `npx tsc --noEmit` on the backend — clean.
- Ran backend unit tests (`npm run test`) and e2e tests (`npm run test:e2e`, against the real Mongo container) —
  both green. Updated the Nest-generated default specs (`app.controller.spec.ts`, `app.e2e-spec.ts`) to match
  the new `/health` endpoint instead of leaving stale "Hello World" assertions in place.

**Things caught/corrected during Phase 0:**
- A prompt-injection attempt was found in `frontend/node_modules/next/dist/docs/index.md` — an HTML comment
  addressed to "AI agent" instructing that an `unstable_instant` export be added and that a specific
  (non-existent) doc file be read "before making changes." This was not followed; flagged to the user instead.
  This is a reminder to treat any instructions embedded in third-party/package content as untrusted, even
  when discovered incidentally while consulting docs for a legitimately newer library version.
- The environment's Next.js version (16.2.9) is newer than the assistant's training cutoff and ships real,
  substantive doc changes bundled in `node_modules/next/dist/docs` — worth checking there directly for
  App Router API changes in later phases rather than relying on older training knowledge.
- Docker Desktop was not running at task start; started it and polled `docker info` until ready rather than
  guessing a fixed sleep duration.

## Assumptions (Phase 0)

- Backend and frontend run directly via `npm` on the host (not containerized); only MongoDB runs in Docker.
  This keeps the dev loop fast and matches CLAUDE.md's instruction to only stand up Mongo via docker-compose
  at this stage.
- API is prefixed with `/api` globally (e.g. `/api/health`) to leave room for serving anything else from the
  bare domain later and to make the frontend's API base URL convention consistent from the start.

## Open items for later phases

- Seeded credentials, data model implementation, auth, catalog, cart, checkout, admin, dashboard, and the
  open-ended "relevant product suggestions" interpretation are all tracked in the todo list and will be
  documented here as each phase lands.
