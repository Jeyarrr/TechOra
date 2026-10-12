# TechOra

TechOra is a full-stack technology e-commerce prototype with a customer storefront and an administrator dashboard. Customers can browse products, manage their profile and shipping address, place test orders, track order status, and review delivered purchases. Administrators can manage the catalog, inventory, orders, and customer information.

Prices are displayed in Philippine pesos (PHP). Checkout currently uses a test cash-on-delivery flow; there is no payment gateway or real delivery integration.

- **Live application:** <https://techora-store.vercel.app/>
- **Source repository:** <https://github.com/Jeyarrr/TechOra>
- **Audience:** senior developers reviewing functionality, architecture, implementation quality, and remaining production work.

## Reviewer accounts and access

Use **Sign in** on the storefront for both customer and administrator access. An account with the `ADMIN` role opens the admin panel after login; there is no separate admin login page.

| User type | Account / access | Password | What to review |
| --- | --- | --- | --- |
| Guest | No account required | Not applicable | Catalog, search, categories, sorting, product details, and visible reviews |
| Customer (`CUSTOMER`) | Create a dedicated review account through **Create an account** | Choose a private password during registration | Profile editing, shipping address, shopping bag, checkout, order history, and eligible reviews |
| Administrator (`ADMIN`) | `techoraadmin@gmail.com` — existing review login, confirmed during the deployment walkthrough | Obtain the current password privately from the project owner | Dashboard, products, prices, stock, images, order status updates, customers, and reports |
| Vendor (`VENDOR`) | No review account or dedicated vendor interface is implemented | Not applicable | Reserved role in the database schema only |

The administrator's current credentials have not been re-tested for this documentation update. Customer registration was confirmed during the deployment walkthrough, but no shared customer review credentials are maintained in this repository. Registering a dedicated reviewer account keeps test orders separate from personal accounts.

Passwords, database connection strings, and Supabase secret keys must be shared privately, not committed to this public README. Accounts belong to the database selected by `DATABASE_URL`: an account created locally will not automatically exist in the live Supabase database.

For an isolated local review, create your own administrator with the seed command described below. No live account is required to review the application locally.

## Implemented features

### Customer storefront

- Product catalog across Smartphones, Laptops, Audio, Wearables, Tablets, Home office, and Accessories.
- Search, category filtering, price/rating sorting, product details, and image fallback handling.
- Registration, sign-in/sign-out, remembered email, profile editing, and a default shipping address.
- Shopping bag with quantity controls and test checkout.
- Database-backed order creation with stock checks, row locking, and transactional inventory updates.
- Order history and order status display.
- Product ratings and reviews after a delivered purchase; duplicate reviews for the same order/product/customer are restricted.

### Administrator workspace

- Dashboard with order totals, customer counts, low-stock products, recent orders, and sales summaries.
- Add and edit products, upload images, and update prices and inventory quantities.
- Delete products with administrator password confirmation, subject to database relationships.
- View orders and change their status.
- View customer records and order summaries.
- View product badges, ratings, and review counts in **Promotions & reviews**.
- View inventory, role counts, and recent activity in **Reports & settings**.

The latter two sections are primarily reporting views; their names do not imply a complete promotion engine or configurable system settings service.

## Technology and architecture

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, Vite 7, custom CSS |
| Backend | Node.js, Express 5, CommonJS modules |
| Database | PostgreSQL through the `pg` driver and parameterized SQL |
| Hosted database | Supabase PostgreSQL |
| Image uploads | Supabase Storage when configured; local `uploads/` fallback for development |
| Hosting | Vercel static frontend and a Node.js API function |
| Tests | Node test runner and a browser-based UI smoke script |

The browser requests `/api/*` on the same origin. In development, Vite proxies those requests to Express on port 3000. On Vercel, `vercel.json` rewrites `/api/:path*` to `api/index.js`, which exports the Express application from `backend/server.js`.

Express queries PostgreSQL directly. User registration and password verification use the application's `public.users` table, **not Supabase Auth**. Passwords are stored as salted scrypt hashes and compared using `timingSafeEqual`.

Image uploads go from the admin interface to Express, which uses a server-side Supabase key to write to the configured storage bucket and returns a public image URL. API startup does not create a local uploads directory, allowing the function to start on Vercel without filesystem writes.

## Project structure

```text
api/index.js                 Vercel function exporting the Express app
backend/server.js            API routes, validation, SQL, and business logic
backend/db.js                Environment loading and PostgreSQL connection pool
backend/images.js            Image parsing, uploads, and deletion
backend/products.js          In-memory fallback catalog
backend/server.test.js       Catalog, startup, and login tests
frontend/src/App.jsx         Storefront state and main page
frontend/src/AdminPanel.jsx  Administrator workspace
frontend/src/AccountModals.jsx  Registration, login, profile, and order dialogs
frontend/src/ProductModal.jsx  Product details and reviews
frontend/src/styles.css      Active React application styles
database/schema.sql          Tables, constraints, and indexes
database/seed.sql            66-product catalog seed
database/seed-admin.js        Environment-configured administrator provisioning
database/migrations/         Incremental SQL for older database versions
scripts/ui-smoke.cjs         Isolated browser UI checks
vite.config.js               Frontend root, output, and development proxies
vercel.json                  Deployment build, output, and API routing
.env.example                Configuration template without real secrets
```

## Local setup

### 1. Install prerequisites and dependencies

Use Node.js **22.12 or later** with npm, plus a PostgreSQL database and `psql` (or a SQL editor). The locked Vite package also supports Node 20.19 or later within the Node 20 release line.

```sh
git clone https://github.com/Jeyarrr/TechOra.git
cd TechOra
npm ci
```

### 2. Configure the environment

Copy `.env.example` to `.env` in the project root. In PowerShell:

```powershell
Copy-Item .env.example .env
```

Set `DATABASE_URL` to your review database and choose your own `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The admin seed requires a password of at least 12 characters. Leave `PORT=3000` for the default Vite proxy configuration.

For local image storage, remove or leave empty the placeholder `SUPABASE_URL` and `SUPABASE_SECRET_KEY` values. Nonempty placeholders would cause the app to attempt a Supabase upload instead of using local storage.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URI; required for persistent data and admin functionality |
| `PG_POOL_MAX` | Maximum connections per application instance; defaults to `1` |
| `PORT` | Local Express port; defaults to `3000` |
| `SUPABASE_URL` | Supabase project URL for hosted image storage |
| `SUPABASE_SECRET_KEY` | Server-only storage key; never expose it in frontend configuration |
| `SUPABASE_STORAGE_BUCKET` | Public image bucket name; defaults to `product-images` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Credentials used by the admin seed script |
| `ADMIN_FIRST_NAME`, `ADMIN_LAST_NAME`, `ADMIN_PHONE` | Optional seed account profile fields |

`SUPABASE_SERVICE_ROLE_KEY` is supported as a legacy fallback for the storage key. `ADMIN_*` variables are used for provisioning; they do not create an account merely by being added to Vercel.

### 3. Initialize a fresh database

For a local PostgreSQL installation:

```sh
createdb -U postgres techora
psql -U postgres -d techora -v ON_ERROR_STOP=1 -f database/schema.sql
psql -U postgres -d techora -v ON_ERROR_STOP=1 -f database/seed.sql
```

Alternatively, execute `schema.sql`, then `seed.sql`, in the SQL editor for a dedicated Supabase review project. Update `.env` to point to the same database.

`schema.sql` is for a fresh database and is not a repeatable migration. The catalog seed inserts 66 products and updates matching product IDs when re-run, including their prices, stock, and images. Use it on a review database rather than overwriting live catalog edits. It does not create users or orders. The current schema already includes the changes represented by the older migration files.

### 4. Create a local reviewer administrator

After configuring `DATABASE_URL` and `ADMIN_*` in `.env`:

```sh
npm run seed:admin
```

This creates or updates the account matching `ADMIN_EMAIL`, including its password and `ADMIN` role, in the configured database. Confirm that the URI points to your intended review database before running it.

Create a customer through the storefront registration form using a separate review email. Registration collects name, email, phone, password, and shipping address; the assigned role is `CUSTOMER`.

### 5. Run the application

Start the backend in one terminal:

```sh
npm run server:watch
```

Start the frontend in another:

```sh
npm run dev
```

Open <http://localhost:5173>. Express runs at <http://localhost:3000>. If you change its port, update the proxy targets in `vite.config.js` as well.

To serve a production frontend build locally:

```sh
npm run build
npm start
```

Then open <http://localhost:3000>. `npm run preview` only previews Vite's frontend output; it is not the full Express application.

Without `DATABASE_URL`, some endpoints use an in-memory catalog, users, and orders. That fallback is temporary, differs from the database workflow, and does not support a complete admin review.

## Suggested review walkthrough

Use an isolated database for tests that change stock, products, or order status.

1. Browse the catalog as a guest; exercise search, filters, sorting, and product details.
2. Register a customer with a review shipping address, sign out, and sign back in.
3. Edit the profile, add an in-stock product to the bag, adjust quantities, and place a test order.
4. Check the customer's order history and verify the inventory deduction.
5. Sign in as the review administrator and inspect the dashboard and order record.
6. Update the test order to `DELIVERED`, then return to the customer account and submit a product review.
7. Add a disposable product, upload an image, change its price/stock, and test password-confirmed deletion before placing orders for that product.
8. Confirm validation for wrong passwords, missing registration fields, unavailable stock, and reviews without a delivered purchase.

Order status values are `PENDING`, `CONFIRMED`, `PROCESSING`, `SHIPPED`, `OUT_FOR_DELIVERY`, `DELIVERED`, and `CANCELLED`. The API validates that the value is allowed, but does not yet enforce a strict transition sequence.

## API overview

| Area | Routes |
| --- | --- |
| Accounts | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/forgot-password`, `PATCH /api/account/profile` |
| Catalog | `GET /api/products`, `GET /api/products/:id` |
| Reviews | `GET` and `POST /api/products/:id/reviews` |
| Customer orders | `GET` and `POST /api/orders` |
| Admin dashboard | `GET /api/admin/dashboard` |
| Admin catalog | `GET` and `POST /api/admin/products`; `PATCH` and `DELETE /api/admin/products/:id` |
| Admin orders | `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status` |
| Admin reporting | `GET /api/admin/customers`, `/api/admin/promotions-reviews`, `/api/admin/reports-settings` |

Catalog queries support `category`, `q`, and `sort` (`low`, `high`, or `rating`). Request bodies, response shapes, and validation are implemented in `backend/server.js`.

## Verification

```sh
npm test
npm run build
```

The Node tests cover fallback catalog validity, API initialization when directory creation is unavailable, and successful/unsuccessful login using a mocked database. They do not prove the live database connection, Vercel routing, or complete authorization security.

```sh
npm run test:ui
```

The UI smoke script uses sample API responses rather than PostgreSQL. It requires a supported installed Chrome/Edge browser and permission to launch child processes; set `TECHORA_CHROME_PATH` if necessary. Fixture accounts such as `admin@example.test` exist only inside this test harness and cannot log into the live application.

## Deployment notes

- Vercel should be connected to **`Jeyarrr/TechOra`**, with the intended commit from `main`. The earlier `techora-vercel` repository was a separate copy and did not receive changes pushed to this repository.
- The build command is `npm run build`; the static output directory is `frontend/dist`.
- `api/index.js` exports the backend. Keep the `/api/:path*` rewrite so nested authentication, review, and admin routes reach Express.
- Set `DATABASE_URL` and `PG_POOL_MAX` in the applicable Vercel environment. Configure the Supabase storage variables and a public `product-images` bucket for hosted uploads.
- Apply schema and seed SQL explicitly to the target database; deploying code does not initialize database tables or migrate local accounts.
- Rebuild after environment changes. When deploying code changes, verify the deployment's source commit includes them rather than rebuilding an older commit.
- The original `techora-vercel.vercel.app` address redirected to `techora-store.vercel.app` when this README was prepared.

## Known limitations and review priorities

This is a functional prototype, not a production-hardened commerce system. The following findings are visible in the current implementation:

1. **Authentication and authorization:** login verifies a password, but subsequent requests rely on a client-supplied `userId`. There is no server-issued session or verified token. The admin helper checks the database role for that ID without proving the caller owns it, and the frontend stores user information in `localStorage`. Server-verified identity and ownership checks are a priority before real customer use.
2. **Password recovery:** the forgot-password route returns a placeholder response. It does not send email, issue reset tokens, or change a password. Login rate limiting and email verification are not implemented.
3. **Payments and fulfillment:** checkout is test cash on delivery. There is no payment collection, courier integration, or delivery notification service. Dashboard order totals should not be treated as settled payment revenue.
4. **Order lifecycle:** changing an order to `CANCELLED` currently changes its status only; inventory restoration and strict transition rules remain to be implemented.
5. **Registration consistency:** user and address creation are separate queries without a shared transaction. A failed address insertion can leave an account without its shipping address.
6. **Database TLS:** Supabase connections currently use TLS with certificate verification disabled (`rejectUnauthorized: false`). Review certificate trust configuration before production hardening.
7. **Uploads and catalog data:** the catalog seed uses placeholder images. Local upload storage is intended for development; hosted persistence depends on Supabase Storage. Uploaded image data has MIME/base64 checks but needs stronger content validation for production.
8. **Coverage:** automated checks are focused regression/smoke tests, not comprehensive database, security, concurrency, or deployed end-to-end coverage. `VENDOR` functionality is not implemented.

These are documented for review; creating this README does not change application behavior or provision additional accounts.
