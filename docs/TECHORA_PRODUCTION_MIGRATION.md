# TechOra production migration

## Image repair prepared — 2026-10-31

- Added the 47 byte-verified images under `frontend/public/catalog-assets`; verified their SHA-256 hashes in the production build. These paths match existing Neon product references.
- Uploads matching these bundled originals reuse the static URL. Static assets are never deleted by product deletion.
- New public images can use Cloudinary with server-only `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. No credentials are configured yet; live Cloudinary integration remains unverified. Existing Supabase storage remains available for compatibility when explicitly configured.
- Serverless uploads no longer fall back to filesystem writes. Missing storage produces an actionable error. UI/server upload limit is now 3 MB to leave room for base64 JSON within Vercel's request limit.
- Seven automated tests pass, including catalog checksum/reuse, unavailable storage, mocked signed Cloudinary upload/deletion, size limit, API initialization, and login. Production build passes.
- Changes are local only: no commit, push, deployment, or Vercel settings change was performed for this repair. Private uploads remain outside this public-product-image implementation.

## Update: Local accounts copied at owner's request — 2026-10-30

The owner explicitly changed the account source to the local database while retaining live product names/prices. Copied 2 local users (1 ADMIN, 1 CUSTOMER) and 1 saved address into Neon transactionally. Verified all copied columns, including IDs, roles, password hashes, salts, and timestamps; verified the 47 destination products were unchanged. No account credentials were reset. Existing local passwords are preserved; login through the new deployment still requires its database configuration to point to Neon.

Private source/destination-before account backup: `C:/Users/jayrc/techora-accounts-backup-19Ts2H`. This includes sensitive personal information and password hashes; keep it outside Git and restrict access. The migration script refuses conflicting records and can skip identical records on rerun.

Local orders and reviews were not copied. Live Supabase accounts/history were not copied: TLS validation now works using the downloaded CA, but the supplied source password was rejected. This is a mixed-source recovery authorized by the owner, not a complete production clone. No Vercel deployment or environment variable was changed.

## Update: Neon catalog recovery completed — 2026-10-30

This update supersedes the preliminary audit status below for the product catalog only. The full production migration remains incomplete.

- Connected to the user-supplied Neon destination with verified TLS and channel binding enabled; PostgreSQL reported version 18.6. The destination had no user tables.
- Rechecked the live catalog against the saved snapshot immediately before import; all exported fields were unchanged.
- Created the six application tables from `database/schema.sql` and inserted all 47 live products in a single transaction. Verified IDs, names, prices, categories, stock, ratings, review counts, badges, descriptions, and mapped image paths before commit.
- Confirmed destination counts after commit: products 47; users, addresses, orders, order_items, and reviews each 0. Existing customer/admin accounts and order/review history have NOT been migrated. Product rating summaries were preserved, but their underlying reviews are absent.
- All 47 local catalog images were SHA-256 identical to the corresponding downloaded live original. Originals, live JSON, mapping manifest, assets, and guarded recovery SQL are saved privately outside Git in `C:/Users/jayrc/techora-catalog-export-PTqNHg`.
- Neon product image references use `/catalog-assets/...`. Those files still need to be deployed at the site's root path; database import alone does not make images available.
- No source records were changed. Vercel variables and deployments were not changed. No full database backup, complete bucket inventory, or production cutover has occurred.
- Credentials are outside Git. Credentials shared in chat should be rotated after access/deployment configuration is stabilized.

## Status — 2026-10-30 (Asia/Manila)

**Preliminary read-only audit completed. Migration is blocked on authenticated source and destination access. No production changes, backups, restores, asset transfers, deployments, or cutover have been performed.**

The live Supabase project is the source of truth. Do not run local seed files against either production or the migration destination. Do not substitute local images for production originals.

## Observed production architecture

- Public application: `https://techora-store.vercel.app/`.
- Read-only `GET /api/products` returned HTTP 200 and 47 product records during this audit. This is a public API count, **not a verified database table count**.
- Those records reference 47 distinct image URLs on `xxqoqyjokxixcwtlnfjb.supabase.co`, all under the public `product-images` storage URL prefix.
- This identifies the image-hosting project. The deployed database host and environment variables still require verification in Vercel; they cannot be inferred conclusively from image URLs.
- Local code: React/Vite frontend; Express backend exported through `api/index.js`; Vercel rewrites `/api/:path*` to that function; PostgreSQL through `pg`.
- Local `.env` points to `localhost`. No production Supabase or destination credentials were found in that file. Secret values were not printed or copied.
- 69 files were found across local `Images/` and `uploads/`. All 47 remote image basenames were absent from that list. This is only a filename comparison; differently named identical files have not been excluded by checksums.
- Frontend hero and fallback catalog source code contain Unsplash URLs. The observed live product response used Supabase exclusively. Deployed static assets, other routes, and external dependencies still need a full inventory.

## Inventory and migration results

| Item | Source evidence | Destination / status |
| --- | --- | --- |
| `users`, `addresses`, `products`, `orders`, `order_items`, `reviews` | Defined in local schema; production existence/counts unverified | Not migrated |
| Public catalog products | 47 returned by live API | Not migrated |
| Referenced public product images | 47 distinct URLs | 0 transferred |
| `product-images` bucket | Referenced by live URLs | Full object listing unavailable |
| Other public/private buckets | Unknown without authenticated listing | Not inventoried |
| Unreferenced objects, documents, versions | Unknown | Not inventoried |
| Missing/failed assets | Not assessed by original-byte downloads | No completeness claim possible |
| Constraints, indexes, sequences, functions, triggers, extensions, policies | Production audit pending | Not migrated |

Zero transfers does not mean zero source objects. The 47 visible image references are not a total storage object count. No individual image integrity or private authorization checks have been performed.

## Authentication and Supabase dependencies

`backend/server.js` implements custom authentication against `public.users`, storing scrypt password hashes and salts. Preserve these columns and user IDs exactly; do not reset passwords or seed replacement accounts. Supabase Auth is not used by the inspected application code. Dashboard-managed Auth users, functions, Realtime subscriptions, policies, and integrations remain unverified until production access is available.

The current app has no server-issued session token: client-supplied user IDs and database role lookups are used for authorization. This is an existing security risk, not something Neon fixes. LocalStorage login state is not a securely validated session. Do not introduce private-file delivery using only these client-supplied IDs. Keep the application origin and IDs stable where possible; explicitly test login and account continuity after migration.

`backend/images.js` currently uploads and deletes through Supabase Storage using server-only credentials. When storage variables are missing, it falls back to local disk, which is not suitable for persistent Vercel uploads. Do not remove Supabase credentials until a tested replacement is selected and deployed. `backend/db.js` currently disables certificate verification for Supabase; the Neon connection must use verified TLS.

## Required access — provide securely, not in chat or Git

Use a private environment file outside the repository, or a secret manager. These are proposed migration variable names; the current app does not consume them automatically.

| Variable / configuration | Required purpose |
| --- | --- |
| `SOURCE_DATABASE_URL` | Live Supabase PostgreSQL connection with read access sufficient to inspect and dump all relevant schemas/data; direct endpoint or compatible session connection, not transaction pooling |
| `SOURCE_SUPABASE_URL` | Confirmed production Supabase project URL |
| `SOURCE_SUPABASE_SECRET_KEY` | Server secret/service-role key authorized to enumerate buckets and read all relevant public/private objects; never a publishable key |
| `NEON_DATABASE_URL` | Isolated empty Neon migration database/branch, with schema creation and restore permissions; direct connection for restore |
| Neon runtime connection | Pooled connection for the Vercel application if appropriate, using verified TLS |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Candidate destination account credentials; sufficient quota and supported asset formats must be verified before choosing it |
| Vercel project access or owner-assisted configuration | Confirm production repository, commit, database host, storage project, environment scopes, and rollback deployment |
| Private backup destination | Restricted-access location outside Git and preferably outside OneDrive syncing; enough disk space for database and original files |

PostgreSQL command-line tools (`pg_dump`, `pg_restore`, `psql`) were not found on PATH. Locate or install a source-compatible version before backup; this does not prove they are absent elsewhere on the machine. If the Supabase project has paused, resume it before export. Do not send real passwords in screenshots.

## Destination storage decision — pending

Cloudinary is the preferred candidate, not yet selected or configured. Confirm storage/transfer quotas, original format support, file size limits, upload presets, and private delivery support against the complete source inventory. Do not apply resize/compression transformations or rely on a fetch URL that still needs Supabase.

For protected files, Cloudinary's `authenticated` delivery type protects originals and derivatives; a merely `private` original has different derivative-access semantics. A secure server-authorized delivery flow must be designed and verified before migrating protected content. If account capabilities or file types do not fit, evaluate Vercel Blob private storage instead. Do not turn private buckets into public URLs.

References: [Cloudinary access controls](https://cloudinary.com/documentation/control_access_to_media), [upload parameters](https://cloudinary.com/documentation/upload_parameters), [upload API](https://cloudinary.com/documentation/image_upload_api_reference).

## Backup and migration gates

These are execution requirements, not completed operations.

1. Verify Vercel's actual source database and storage settings. With read-only database transactions, inventory every application schema/table and exact row count, keys, constraints, indexes, sequences, extensions, functions, triggers, policies, and managed-service dependencies. Enumerate every storage bucket and every paginated object/prefix, including private and unreferenced objects. Inventory URL/path references throughout relevant text/JSON columns and deployed static assets.
2. Create a restricted full source database archive of accessible schemas plus a restore-scoped application archive. Preserve managed-schema definitions/policies for reference, but do not blindly restore Supabase system ownership, roles, or schemas into Neon. Record any permission-limited omissions. Database archives do not contain storage object bytes.
3. Download every relevant original object using authenticated reads. Preserve logical path, original filename/extension, content type, source object ID, size, timestamps, bucket visibility, owner/access metadata, and related record/column references in a private manifest. Store originals with path-traversal-safe local names and SHA-256 checksums. Protect backups containing password hashes and personal information. Retain external originals needed for independence, subject to access/usage rights.
4. Reconcile manifest object counts, bytes, and paths against complete paginated listings. Hash downloaded bytes and retry/resume failed downloads. Record source modifications during backup; an initial dump and asset copy alone do not establish a consistent final production snapshot.
5. Restore audited application schemas/data to an empty Neon branch. Do not run `schema.sql`/`seed.sql` in place of restoring production. Preserve IDs, password hashes/salts, sequence positions, foreign keys, indexes, triggers, and compatible functions/extensions. Compare row counts and stable per-record content hashes; counts alone are insufficient. Review ownership/grants intentionally.
6. Upload verified originals without transformations. Use stable source-to-destination identities, no blind overwrite, checkpoints, bounded retries, and checksum/metadata verification when resuming. A duplicate filename is not proof of duplicate content. Maintain a private old-to-new mapping including provider ID, resource/delivery type, original URL/path, checksum, permissions, and related records.
7. Download destination originals and compare hashes; test public accessibility and deny unauthenticated access to protected assets. Change image references **only in Neon**, transactionally and only where the expected old value matches. Do not persist temporary signed URLs as permanent image references.
8. Only after verified backups and destination transfers, implement and test new upload/retrieve/replace/delete integration, including ownership checks and deletion restricted to destination-owned objects. Keep existing Supabase objects untouched. Never silently fall back to ephemeral storage in production.

See [Neon's PostgreSQL migration guidance](https://github.com/neondatabase/website/blob/main/content/docs/import/migrate-from-postgres.md) for archive export/restore and avoiding pooled connections during dumps. Restore compatibility must be checked against the actual source version and extensions.

## Verification and cutover plan

- Compare all table counts and row content, relationship integrity, sequences, object totals, checksums, access permissions, and image-to-record mappings. Produce a private failure list with record IDs and reasons; a nonempty unresolved required-asset list blocks cutover.
- Test existing customer/admin login using owner-provided test accounts, registration, profile edits, orders, reviews, dashboard, catalog CRUD, and image upload/replacement/deletion on the isolated destination. Verify routes, desktop/mobile layouts, and no remaining required Supabase URLs in records or deployed frontend bundles. Keep test records separate from the source comparison.
- Select an owner-approved write-maintenance window. Freeze writes/uploads at all production entry points, including admin jobs and dashboard edits, before the final consistent database export and asset reconciliation. An `updated_at` scan alone is insufficient: it can miss deletes or changes without timestamp updates.
- Restore/reconcile the final source state into an isolated destination without overwriting unrelated/newer destination data. If unexpected destination writes or source changes occur, stop and re-plan rather than merge blindly. Reapply the verified URL mapping and validate again while source writes remain frozen.
- Obtain explicit owner approval before changing Vercel production variables or promoting a deployment. No approval has been given for cutover.
- Save the original Vercel configuration securely. Use the tested new database and storage variables only on the approved deployment. Keep secrets server-only. Confirm the production commit and branch, TLS, pool limits, function duration, and upload limits.
- Keep Supabase unchanged and available through a rollback window. Before accepting destination writes, test rollback on an isolated environment. After destination writes begin, switching back would lose them: freeze writes and reconcile/export destination changes first. Document that procedure and prove it before calling rollback tested.

## Tests performed and outstanding work

Performed: code/configuration inspection; redacted local environment inspection; public catalog GET (HTTP 200); URL-host/bucket classification; local/remote basename comparison; PostgreSQL tool PATH check.

Not performed: authenticated source audit, full database/storage backup, Neon restore, Cloudinary transfer, original checksum validation, private-file authorization checks, migrated CRUD/authentication testing, responsive comparison, final synchronization, rollback rehearsal, or deployment. Application build/tests have not been rerun for this documentation-only audit; no runtime code was changed.

The next step is to supply the source credentials securely and confirm an isolated Neon destination, candidate Cloudinary account, and private backup location. Complete production preservation cannot be certified from the public catalog alone.
