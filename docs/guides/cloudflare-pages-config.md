# Cloudflare Pages hosting config (required)

This repo relies on Cloudflare Pages parsing `_redirects` from the **build output
directory root**.
If `_redirects` is not in the Pages output root, the rewrite for `/` will not
run and the site root will 404.

## One correct Pages config

In your Cloudflare Pages project:

- Framework preset: **None**
- Root directory: **`/`** (repo root)
- Build output directory: **`.`** (repo root)

Cloudflare Pages (hosting) **Build output directory must be `.`** for this repo,
because `_redirects` lives at repo root and must be deployed at the output root
for `/  /EN/index.html  200` to take effect.

## Why this matters

The repo contains a root rewrite rule in `_redirects`:

- `/  /EN/index.html  200`

Cloudflare Pages only applies `_redirects` when it exists in the directory it deploys.
If you set the output directory to something else (for example `dist/`, `build/`,
or `public/`), Pages will not see `_redirects` and the rewrite won’t be applied.

## Guardrail

Run this locally (or in CI) to verify the Pages output directory contains the
expected `_redirects` rule:

- `npm run verify:pages`

If you ever deploy from a different output directory, set `PAGES_OUTPUT_DIR`:

- `PAGES_OUTPUT_DIR=dist npm run verify:pages`
