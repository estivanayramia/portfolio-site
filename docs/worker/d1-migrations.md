# D1 migrations

This repo uses a Cloudflare D1 database (binding: `DB`) for the error dashboard.

## Schema

The schema is managed via D1 migrations under `worker/migrations/`.

Current migration:

- `0001_create_errors.sql`

It creates the `errors` table and indexes:

- `idx_errors_timestamp` (timestamp DESC)
- `idx_errors_status` (status)
- `idx_errors_category` (category)

## Apply migrations

1) Ensure you have Wrangler configured for the worker project.

2) Run migrations against the desired environment/database:

- Local (requires a local D1 dev setup):
  - `wrangler d1 migrations apply portfolio-errors --local`

- Remote (Cloudflare):
  - `wrangler d1 migrations apply portfolio-errors`

If you maintain separate Preview/Production databases, apply migrations to each.

## Verify health

`/api/health` includes `d1Ok`.

- `d1Ok: true` means the worker can successfully execute a lightweight query (`SELECT 1`).
- `d1Ok: false` means the D1 binding is missing or the query failed.
