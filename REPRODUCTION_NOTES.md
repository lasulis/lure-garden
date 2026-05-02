# Reproduction Notes

This repository was pushed with as much of the working project as possible while keeping private credentials out of Git history.

## Included

- application source code
- route changes
- admin/login screens
- Supabase integration code
- migration SQL checked into `migrations/`
- schema snapshot in `supabase-schema.sql`
- local preview artifact `lure-preview.html`
- lockfile and build config

## Not committed for safety

- `.env`
- `.env.save`
- `.dev.vars`
- `wrangler.jsonc.save`

## Secret variables you must restore locally

Copy the real values from the original machine into:

- `.env`
- `.dev.vars`

Required keys:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`

## Original local source of truth

At the time this repository was prepared, the local files with the real secrets were stored at:

- `/Users/reixachh/Documents/Codex/2026-04-26/como-faco-pra-subir-um-projeto/garden-sparkle-chronicles-main/.env`
- `/Users/reixachh/Documents/Codex/2026-04-26/como-faco-pra-subir-um-projeto/garden-sparkle-chronicles-main/.env.save`
- `/Users/reixachh/Documents/Codex/2026-04-26/como-faco-pra-subir-um-projeto/garden-sparkle-chronicles-main/.dev.vars`

## Files outside this Git repository

These were not added because they live outside the actual app repository or are redundant archive artifacts:

- `/Users/reixachh/Documents/Codex/2026-04-26/como-faco-pra-subir-um-projeto/garden-sparkle-chronicles-main.zip`
- `/Users/reixachh/Documents/Codex/2026-04-26/como-faco-pra-subir-um-projeto/garden-sparkle-chronicles-main - cópia.zip`
- `/Users/reixachh/Documents/Codex/2026-04-26/como-faco-pra-subir-um-projeto/__MACOSX/`
