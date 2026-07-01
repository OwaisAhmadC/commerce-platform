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

## Phase 1 — Database + Seed

**What was built:**
- Nest CLI-generated modules for `users`, `categories`, `products`, `cart`, `orders`, each wired with
  `MongooseModule.forFeature` and exporting `MongooseModule` so other modules can inject the same models later
  (e.g. cart/orders will need the `Product` model to check stock).
- Schemas per CLAUDE.md's data model, colocated in each module's `schemas/` folder:
  - `User`: unique email index, bcrypt hash stored (never the plaintext password), `role` enum.
  - `Category`: unique name.
  - `Product`: text index on `name` (search), index on `categoryId`, index on `priceCents` (filter/sort).
  - `Cart`: one document per user (`userId` unique index), items embedded as a subdocument array — not a
    separate collection, per CLAUDE.md's "Mongo-idiomatic" guidance.
  - `Order`: embeds a snapshot of `name` + `priceCentsAtPurchase` per item, not just a `productId` reference —
    intentional, so historical orders stay accurate if a product's price or name changes later.
- Seed script (`backend/src/database/seed.ts`, run via `npm run seed`): clears and repopulates users,
  categories, products. Creates 1 admin + 1 customer (bcrypt-hashed passwords), 4 categories, 18 products with
  varied price/stock (including at least one zero-stock item, useful later for testing the "out of stock"
  checkout edge case). Prints seeded credentials to the console on every run.

**Verification performed:**
- `npx tsc --noEmit` — clean.
- Ran `npm run seed` against the real Mongo container and inspected the result directly via `mongosh`
  (not just trusting the script's own console output): confirmed document counts (2 users / 4 categories /
  18 products), confirmed the `email` unique index, `categoryId` index, `name` text index, and `priceCents`
  index all exist exactly as declared, and spot-checked a product document's shape.

## Phase 2 — Auth

**What was built:**
- `UsersService` (`findByEmail`, `findById`, `create`) added to `UsersModule`, used by auth so the users module
  owns all direct DB access to its own collection.
- `AuthModule`: `PassportModule` + `JwtModule.registerAsync` (default secret = access secret, used by the
  passport-jwt strategy), `AuthService`, `AuthController`, `JwtStrategy`.
- `AuthService.signup`: rejects duplicate email with `409 Conflict`, hashes password with bcrypt (10 rounds),
  creates the user as `customer` role (no client-settable role — admins are only created via the seed script,
  not exposed through signup).
- `AuthService.login`: `401 Unauthorized` for both "no such email" and "wrong password" — deliberately the same
  message/status for both so the API doesn't leak which emails are registered.
- `AuthService.refresh`: verifies the refresh JWT against a separate `JWT_REFRESH_SECRET`, re-issues both
  tokens. Tokens are stateless (no DB-backed revocation/rotation list) — documented as a scope trade-off below.
- `JwtStrategy`: on every authenticated request, re-fetches the user from the DB by `payload.sub` rather than
  trusting the JWT payload blindly — so a deleted user's still-valid access token is rejected immediately
  instead of working until expiry.
- `JwtAuthGuard` + `RolesGuard` + `@Roles()` decorator in `src/common/` (shared, not auth-specific) since later
  phases (admin product/order routes) will reuse `RolesGuard` — `CanActivate` returns true when a route has no
  `@Roles()` metadata, so it only restricts routes that opt in.
- Frontend: `lib/api/client.ts` (typed fetch wrapper that surfaces backend validation error arrays and status
  codes as a typed `ApiError`), `lib/api/auth.ts`, `lib/auth/AuthContext.tsx` (React context, persists
  `{accessToken, refreshToken, user}` to `localStorage`, hydrates on mount), `/login` and `/signup` pages with
  client-side validation (email regex, 8-char password minimum) that mirrors the backend's `class-validator`
  rules, and a `NavBar` component showing logged-in state / log-out.

**Verification performed:**
- Backend unit tests (`auth.service.spec.ts`): rejects signup with a duplicate email, verifies the stored hash
  is not the plaintext password (round-trips through `bcrypt.compare`), rejects login for a non-existent email,
  rejects login with the wrong password, and confirms a correct login returns tokens + user. 6/6 tests passing
  including the Phase 0 health check tests.
- Live end-to-end testing against the running backend (not just unit tests) via curl: signup → 201 with tokens;
  repeat signup with the same email → 409; wrong password → 401; correct login → tokens; `GET /auth/me` with a
  valid token → 200 with decoded user; same endpoint with no token → 401; weak password on signup → 400. Also
  confirmed the seeded admin account logs in with `role: "admin"`.
- Real browser verification (Playwright, driven from a throwaway script, not part of the repo): signed up a
  fresh account and confirmed the nav bar updates to show the logged-in email; logged out and confirmed the nav
  reverts to Log in/Sign up; logged in with the seeded customer account and confirmed the nav updates again;
  attempted login with a wrong password and confirmed an inline error renders without a page crash. Screenshots
  were inspected directly rather than only trusting the script's pass/fail assertions. The only browser console
  message was the expected failed-fetch log for the intentional 401, not an unhandled exception.
  (Note: this sandbox has no outbound internet access to most hosts, but `cdn.playwright.dev` for the Chromium
  binary download happened to succeed — this was incidental, not something to rely on being available.)
- Re-ran `npm run seed` after manual/browser testing to reset the DB to the known clean seeded state.

**Things caught/corrected during Phase 2:**
- `nest g controller/service auth --flat` generated files at `src/auth.controller.ts`/`src/auth.service.ts`
  (project root) instead of inside `src/auth/`, and wired them into `AppModule` directly instead of
  `AuthModule` — the `--flat` flag suppresses the module-relative subfolder Nest normally infers. Caught by
  reading the CLI output and `app.module.ts` diff immediately after generation; fixed by moving the files and
  rewriting `app.module.ts`/`auth.module.ts` by hand.
- TypeScript initially rejected `expiresIn: '15m'` (a plain `string`) against `@nestjs/jwt`'s `JwtSignOptions`,
  which types `expiresIn` as `number | StringValue` (a template-literal type from the `ms` package). Fixed with
  a local `Duration` template-literal type cast at the two call sites rather than widening the option to `any`.
- The IDE repeatedly reported stale "Cannot find name 'describe'/'expect'" diagnostics on freshly-written spec
  files; each time, an actual `npx tsc --noEmit` run showed the file was fine — the diagnostics were just
  lagging the editor's view of the file. Learned to verify with a real compiler invocation before treating an
  IDE diagnostic as ground truth, rather than chasing phantom errors.
- The first attempt at browser verification failed with `net::ERR_CONNECTION_REFUSED` because both dev servers
  (started as detached background shells in an earlier turn) had died when the underlying shell session was
  torn down between conversation turns. Fixed by restarting both through the harness's tracked
  `run_in_background` mechanism instead of a disowned `(cmd &)` subshell, and polling the port before
  proceeding instead of guessing.

**Scope trade-offs (documented, not silently decided):**
- Refresh tokens are stateless JWTs with no server-side revocation list. A compromised refresh token remains
  valid until its 7-day expiry even if the user "logs out" (logout is client-side only: it just clears
  localStorage). A production version would store refresh tokens (or their hashes) server-side with rotation
  and revocation on logout/reuse-detection. Acceptable for this assessment's scope given the time budget.
- Tokens are stored in `localStorage` on the frontend rather than an `httpOnly` cookie, which is more exposed to
  XSS. Chosen for simplicity (no CSRF-token plumbing, no cross-origin cookie configuration needed between
  `localhost:3000` and `localhost:4000`) — a real production deployment should prefer `httpOnly`, `Secure`,
  `SameSite` cookies.

## Phase 3 — Product catalog (read paths)

**What was built:**
- `ProductsService.findAll`: builds a Mongoose filter from `ListProductsQueryDto` (search, categoryId, price
  range), sorts by `price_asc` / `price_desc` / `newest` (default), paginates with `skip`/`limit`, and returns
  `{ items, total, page, limit, totalPages }`. `ProductsService.findById` returns 404 (not a 500) for both a
  malformed ObjectId and a well-formed one that doesn't exist.
- **Deliberate deviation from CLAUDE.md's literal wording:** search uses a case-insensitive regex on `name`
  (escaped to avoid the input being interpreted as a regex) rather than MongoDB's `$text` operator. `$text`
  matches whole/stemmed words, so searching "head" would **not** find "Wireless Headphones" — a real UX gap for
  a product search box where users expect substring/prefix matches. The `name` text index from Phase 1 is kept
  in place (harmless, and available if relevance-ranked search is worth revisiting later), but the query path
  uses regex. At this catalog's size (18 products) the performance difference is irrelevant; documented here
  since it's a conscious spec interpretation, not an oversight.
- `CategoriesService`/`CategoriesController`: simple public `GET /categories`, used to populate the storefront's
  category filter dropdown.
- Added a shared `toJsonTransform` (`src/common/mongoose/to-json-transform.ts`) applied via each schema's
  `toJSON` option, so every API response uses `id` instead of Mongoose's raw `_id`/`__v`. Applied retroactively
  to all five schemas (User, Category, Product, Cart, Order) for a consistent contract now rather than
  patching it in piecemeal later. The `User` schema's transform additionally strips `passwordHash` — defense in
  depth in case a future endpoint accidentally returns a raw user document instead of a shaped DTO.
- Frontend: `lib/api/products.ts`, `lib/api/categories.ts`, `lib/format.ts` (price formatting). The catalog page
  (`app/page.tsx`) keeps filter/sort/page state in the URL query string (via `useSearchParams`/`router.push`)
  rather than local-only React state, so filters are shareable/bookmarkable and back/forward navigation works —
  a small deliberate upgrade over the minimum "it filters" requirement. Product detail page
  (`app/products/[id]/page.tsx`) is a Server Component that calls `notFound()` on a 404 from the API.

**Verification performed:**
- `npx tsc --noEmit` clean on both backend and frontend.
- Live curl testing against the running backend: category list; default listing (newest, page 1); substring
  search ("head" matches "Wireless Headphones"); `sort=price_asc`/`price_desc` (spot-checked ordering);
  pagination (`page=2&limit=5` returns 5 items, correct `totalPages`); price range filter (confirmed every
  returned item's price actually falls in range); invalid `categoryId` → 400 (DTO validation catches a
  non-ObjectId before it reaches the service); valid product id → 200; well-formed but non-existent id → 404;
  malformed id → 404 (not 500).
- Real browser verification (Playwright): loaded the catalog (18 products, 12 per page), searched "Headphones"
  (narrowed to 1), filtered by the "Books" category (narrowed to 5), changed sort order, clicked into a product
  card and confirmed the detail page rendered the correct name/price/description, and navigated to a
  non-existent product id and confirmed Next's 404 page rendered (not a crash). Screenshots inspected directly —
  confirmed the seeded zero-stock item ("Wireless Headphones") correctly shows "Out of stock" in both the
  catalog grid and the detail page.

**Things caught/corrected during Phase 3:**
- `import { FilterQuery } from 'mongoose'` failed to compile — Mongoose 9.x (installed here, newer than this
  assistant's training data) renamed that type to `QueryFilter<T>`. Found by grepping the installed package's
  own `.d.ts` files (`node_modules/mongoose/types/query.d.ts`) rather than guessing from memory, since the
  installed major version postdates what's in training. Worth remembering for later phases that also touch
  Mongoose query typing.
- Caught a self-inflicted duplicate-fetch bug while writing the catalog page: an early draft called
  `listCategories()` twice in the same `useEffect` (one result discarded). Removed before it shipped.

## Phase 4 — Cart

**What was built:**
- `CartService` builds a "hydrated" cart view on every read (`{ items: [{productId, name, imageUrl, priceCents,
  quantity, stock, lineTotalCents}], totalCents }`) by looking up current product data for the cart's stored
  `{productId, quantity}` pairs — the cart itself never stores a price snapshot (unlike orders), so line totals
  always reflect the product's live price, which is the correct behavior before checkout.
- Stock is enforced server-side on both add and update: `POST /cart/items` sums the requested quantity with
  whatever's already in the cart for that product and rejects with `409` if the total would exceed
  `product.stock`; `PATCH /cart/items/:productId` rejects the same way for the new absolute quantity. Client-side
  quantity inputs are also capped at `stock` for UX, but the server is the actual authority — verified by testing
  the same limits via curl directly (see below).
- Defensive consistency check: if a product referenced in someone's cart was deleted after being added (not
  currently possible via the UI since there's no delete-product endpoint yet, but will be once Phase 6 admin CRUD
  exists), `buildView` silently drops it from both the returned view and the persisted cart array rather than
  crashing or returning a broken line item.
- All cart routes (`GET /cart`, `POST /cart/items`, `PATCH /cart/items/:productId`,
  `DELETE /cart/items/:productId`) sit behind `JwtAuthGuard` at the controller level and always operate on
  `req.user.userId` from the token — there is no way to pass another user's id in, so cart ownership is
  enforced by construction, not by an extra check.
- Frontend: `lib/api/cart.ts`, an `AddToCartForm` client component embedded in the (Server Component) product
  detail page, a `Cart` link in the nav, and `/cart` page with per-line quantity editing and removal, showing
  line totals and an order total.
- Fixed the seed script to also clear the `carts` collection. It previously only cleared users/categories/
  products; since re-seeding creates the customer user with a **new** `_id`, any previously-seeded cart would
  become an orphaned document tied to a `userId` nothing points to anymore. Caught this by reasoning about
  re-run behavior, not by hitting a visible bug — worth calling out since orphaned data like this is exactly the
  kind of "silent" issue that doesn't show up until much later.

**Verification performed:**
- Live curl flow against the running backend: `GET /cart` with no token → 401; empty cart for a fresh user;
  add 2 of a product, add 3 more (confirmed quantities merge to 5, not two separate line items); attempt to add
  enough to exceed stock → 409; update quantity to exactly the stock limit → succeeds; update one over the limit
  → 409; remove the item → empty cart; update a product no longer in the cart → 404; add with `quantity: 0` →
  400 (DTO validation); add a well-formed but non-existent product id → 404.
- Real browser verification (Playwright): confirmed the cart page prompts to log in when logged out; logged in,
  added a product with stock via the detail page's quantity selector, confirmed the button shows "Added!";
  opened `/cart` and confirmed the correct quantity and line total rendered; changed the quantity input and
  confirmed the total updated; removed the item and confirmed the "cart is empty" state. Zero browser console
  errors across the whole flow.

## Design workflow

Decided with the user up front (Phase 2 checkpoint): build functional pages with plain/provisional Tailwind
styling now to keep momentum on wiring the app end-to-end. Once the core flows work, a separate design agent
(v0 / Figma AI / Claude Design) will be run by the user to produce the actual visual system, which then gets
implemented/integrated across storefront + admin. Current page styling should be read as "functionally correct,
visually provisional" until that pass happens — not the final look.

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
