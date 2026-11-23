# Jimbot Edge Function

Edge Function entrypoint: `supabase/functions/jimbot/index.ts`.
Model calls go to the OpenCode OpenAI-compatible gateway using `hy4-flash-free`.

## Required secrets

- `OPENCODE_API_KEY` (set it yourself)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (injected automatically by hosted Supabase; the CLI rejects `SUPABASE_*` names in `secrets set`)

```bash
supabase secrets set OPENCODE_API_KEY=your_key_here
```

Optional settings:

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENCODE_MODEL` | `hy4-flash-free` | Chat model id on the gateway |
| `OPENCODE_BASE_URL` | `https://opencode.ai/zen/go/v1` | Gateway base URL |
| `EMBEDDING_API_KEY` | unset | Optional OpenRouter key for hybrid search. Without it, search falls back to `ilike` text matching |
| `EMBEDDING_BASE_URL` | `https://openrouter.ai/api/v1` | Embedding endpoint base URL |
| `EMBEDDING_MODEL` | `nvidia/nemotron-3.5-embed-1b:free` | Must match the model used by `pnpm embed:businesses` |

For local development, put the gateway settings in the repo-root `.env.local` (already present with an empty `OPENCODE_API_KEY` for you to fill in). `supabase functions serve --env-file` reads that file. Keep these names without a `VITE_` prefix, Vite only exposes `VITE_` vars to the browser.

```env
OPENCODE_API_KEY=your_key_here
OPENCODE_MODEL=hy4-flash-free
OPENCODE_BASE_URL=https://opencode.ai/zen/go/v1
# optional, only for hybrid vector search (OpenRouter)
EMBEDDING_API_KEY=your_openrouter_key_here
EMBEDDING_BASE_URL=https://openrouter.ai/api/v1
EMBEDDING_MODEL=nvidia/nemotron-3.5-embed-1b:free
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected by the local Supabase stack, so they do not need to be in `.env.local`.

## Embeddings (optional)

Hybrid search needs vectors in `business_embeddings`. After resetting or reseeding the DB, run:

```bash
pnpm embed:businesses
```

That script reads `EMBEDDING_API_KEY` from the repo-root `.env.local` (or `supabase/functions/.env`, or the process env) and writes vectors using `EMBEDDING_MODEL`. The cache hash includes the provider and model, so switching models automatically re-embeds every row on the next run. If `EMBEDDING_API_KEY` is unset, Jimbot still works via `ilike` + type aliases (no invented places), but ranking is weaker.

Nemotron returns 2048-dimension vectors while `business_embeddings.embedding` is `vector(1536)`. Both the indexer and the query path truncate to the first 1536 dimensions and re-normalize, so no database migration is needed. NVIDIA documents truncated embeddings as effective for retrieval when re-normalized.

## Serve locally

With Docker and the Supabase CLI:

```bash
supabase functions serve jimbot --env-file .env.local
```

Without Docker (runs the same function directly in Deno from the repo root):

```bash
bunx --yes deno run --allow-all --env-file=.env.local --config supabase/functions/jimbot/deno.json supabase/functions/jimbot/index.ts
```

Both read `.env.local`, which needs `OPENCODE_API_KEY`, `SUPABASE_URL` and `SUPABASE_ANON_KEY`. To make the Vite app call this local function instead of the deployed one, set `VITE_JIMBOT_FUNCTION_URL=http://localhost:8000/` in `.env.local`. Remove that line to go back to the deployed function.

## Request shape

`POST /functions/v1/jimbot`

```json
{
  "message": "Plan mo ako 1-day trip sa Iloilo",
  "conversationId": null,
  "planningContext": null,
  "explicitConfirmed": false,
  "history": []
}
```

`Authorization: Bearer <supabase-user-jwt>` is optional for public planning tools, but required for user-scoped tools and `save_itinerary`.
