# GitHub Pages demo

This repository can publish a browser-only Techora demo at:

`https://jeyarrr.github.io/TechOra/`

It is intentionally separate from the real Express and PostgreSQL application. The demo uses sample catalog data and stores accounts, bags, orders, reviews, and admin edits in the visitor's own browser storage. Nothing is sent to or saved in the production database.

## Publish it

1. Push these changes to the `main` branch.
2. In GitHub, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Open the **Actions** tab and wait for **Deploy Techora demo to GitHub Pages** to finish.
5. Open the published URL shown in the workflow or in Settings → Pages.

The workflow deploys every new push to `main`.

## Demo accounts

- Customer: any email address and password.
- Admin: `admin@techora.demo` / `demo-admin`.

Do not use real passwords, addresses, or payment information in the demo.
