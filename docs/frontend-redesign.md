# Techora frontend redesign

## Audit

The live entry is `frontend/src/main.jsx`, which loads `App.jsx` and `src/styles.css`. The older `frontend/app.js` and `frontend/styles.css` are not loaded by the Vite entry. There is no frontend router: storefront anchors and state-controlled modals/modules are the navigation model.

Screens reviewed: storefront/catalog; product details and reviews; shopping bag; checkout; login, registration and password recovery; profile and shipping-address editing; customer order tracking; admin dashboard and insight dialogs; product filtering, creation, upload, editing and password-confirmed deletion; order fulfilment; customers; promotions/reviews; reports/settings.

Problems: accumulated duplicate CSS overrides; hover-only actions; unbounded content widths; small text and touch targets; tables without mobile field labels; modal focus/scroll management absent; DOM-created account navigation; loading states that resemble empty data; repeated dialog markup; oversized decorative image areas; no unified error or pending presentation.

## Direction

Slate text, white surfaces, pale neutral canvas and a restrained teal accent. Shared spacing, 8–12px corner radii, clear focus rings, 44px primary controls, modest headings, consistent inline SVG icons, contained product imagery and data-led admin screens. Desktop navigation becomes a dismissible mobile menu. Admin content has one viewport scroll area; tables become labeled cards on phones. All dialogs share focus trapping, Escape, focus restoration and background scroll locking.

## Constraints

Keep API paths, payloads, authentication storage, catalog/category behavior, order states and database operations. No backend/schema changes. Do not invent discounts, reports or activity unsupported by the API.

Tailwind and Lucide were requested but are not installed; npm dependency retrieval is blocked by the environment (ECONNREFUSED). The redesign therefore uses a consolidated token-based stylesheet and a reusable local SVG icon component without adding unresolved imports. Tailwind migration remains a follow-up once package installation is available.

## Verification

Use production compilation where available, parse all React/CSS files, and inspect rendered screens at 320, 375, 430, 768, 1024, 1280 and 1440px. Existing `npm test` covers the backend catalog only; it is not evidence of responsive/browser correctness. Record actual validation results in the final handoff.

### Results in this environment

- Production-mode frontend bundling using the installed native esbuild executable succeeded (React, JavaScript and CSS imports resolved).
- React and CSS parsing succeeded. Backend catalog test passed. Git whitespace check passed.
- Shared React components rendered successfully in server-render checks: signed-out and signed-in headers, out-of-stock product card, image fallback, password field labels, and pagination controls.
- Standard `npm run build` is blocked at Vite's configuration bundler by Windows `spawn EPERM`.
- Headless Chrome is blocked by Windows IPC access restrictions. Responsive screenshots and browser interactions could not be verified here.

Run `npm run test:ui` from a normal terminal with Chrome or Edge installed. The script compiles the frontend, launches an isolated browser, and serves sample API responses on port 4187. It checks the seven requested viewport widths, all admin modules, dialogs, keyboard focus, category filtering, pagination, login errors/success, profile screens, reviews, bag/checkout and product CRUD. It writes screenshots and a report into ignored `.cache/ui-preview/`. It does not access the database. This browser script was added but could not complete in the restricted environment.

### Component ownership

- `App.jsx`: storefront, cart, checkout and existing top-level account/catalog state.
- `AccountModals.jsx`: login, registration, recovery, profile and order tracking.
- `ProductModal.jsx`: product detail/review flow.
- `AdminPanel.jsx`: all admin modules and product management.
- `components.jsx`: header, catalog cards and pagination.
- `ui.jsx`: shared dialogs, fields, icons, image fallback and feedback.
- `lib.js`: currency formatting, existing categories and response errors.
- `styles.css`: tokens, shared controls and ordered responsive rules.
