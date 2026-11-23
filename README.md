# Bitinary

## What this project is

Bitinary is a mobile-first travel and local-business discovery app focused on the Philippines. It has three main experiences:

- **Traveler app** for discovering businesses, viewing posts and reviews, planning itineraries, using Jimbot, and capturing private Moments.
- **Bitinary Business** for owners to set up a business profile, publish content, review comments, manage reviews, and view business activity.
- **Developer console** for internal user, business, moderation, verification, banner, and configuration workflows.

The application is a React single-page app. Supabase provides authentication, PostgreSQL data, and Storage; deployment is configured for Vercel.

## Technology

- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4, with Bootstrap 5 / SCSS for existing business-profile components
- React Router 8
- Supabase JS for Auth, database queries, and Storage
- MapLibre GL for map views
- Motion for animations; Lucide React for icons
- Vercel SPA rewrite (`vercel.json`) and PWA assets (`public/manifest.webmanifest`, `public/sw.js`)
- Figma Make Vite plugins and site configuration in `vite.config.ts`

## Application structure

```text
src/
  app/                 App providers, routing, account state, language, and theme
  biz/                 Business dashboard, workspace state, database helpers, and pages
    db/                Supabase queries and business media helpers
    pages/             Business dashboard screens
  components/          Shared layout, cards, forms, and UI components
  data/                Static/demo data and domain types
  dev/console/         Developer/admin console
  lib/                 Supabase client, auth helpers, browser hooks, and utilities
  screens/             Traveler, signup, business setup, and Moments screens
  styles/              Bootstrap SCSS integration
supabase/
  schema.sql           Schema, RLS, and Storage policies
  migrations/          Incremental database changes
tests/                 Node-based regression tests
public/                PWA manifest, service worker, and static assets
```

### Startup and shared state

`src/main.tsx` imports global styles, applies the saved theme before first paint, registers the production service worker, and mounts `src/app/App.tsx`. `App.tsx` composes the global providers; keep their nesting in sync with provider dependencies.

`src/app/routes.tsx` is the route map:

- `/` is the traveler experience.
- `/biz/*` is the separate business experience.
- `/bitinarydev/*` is the developer console.

The traveler app uses `StoreProvider`, `AccountProvider`, and `LangProvider`. Small preferences and some UI state are persisted in browser local storage; account-backed and shared records are loaded from Supabase by their feature modules. Do not assume every saved item is server-synced.

The business app has its own `BizProvider` and business language preference. Workspace loading and persistence live in `src/biz/store.tsx`, while focused Supabase operations live in `src/biz/db/`.

### Supabase and media

`src/lib/supabase.ts` creates the browser Supabase client. The browser must use only the public anon/publishable key; database and Storage access must be protected by Row Level Security (RLS). Never put a service-role key in client code or a `VITE_` variable.

The SQL schema includes traveler profiles/preferences, businesses, hours, menus, posts, comments, reviews, saved places, itineraries, Moments, reservations, notifications, and developer-console data. Review `supabase/schema.sql` and the relevant migration before changing database behavior. Apply database changes through the project's approved Supabase workflow, then test with the appropriate signed-in and anonymous roles.

Business image/video paths are saved in database rows; signed URLs are generated when media is displayed. The Moments map similarly reads Storage paths and requests signed URLs for private images. If media does not load, check in this order:

1. Confirm the row's `storage_path` and exact bucket/object path.
2. Confirm the object exists in the expected bucket.
3. Check Storage RLS policies for the current user and intended audience.
4. Inspect the `createSignedUrl` error in the browser console/network panel.
5. Confirm the UI is resolving a stored path rather than a stale or temporary `blob:` URL.

A signed URL request can fail even when the object exists if Storage RLS does not permit the requesting role to read it.

## Setup

The repository toolchain is Node.js 22 and pnpm 10.34.3 (see `.mise.toml`). Install dependencies using the package manager selected for your checkout:

```sh
pnpm install
```

Create a local `.env.local` file with values from your own Supabase and Turnstile projects:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key
```

These are browser-visible settings, not secrets. Supabase RLS is the security boundary. Do not commit credentials or use a Supabase service-role key in the frontend.

Jimbot's server-only gateway settings live in the same `.env.local`. The file already has `OPENCODE_API_KEY=` for you to fill in, along with `OPENCODE_MODEL` and `OPENCODE_BASE_URL`. Vite only exposes `VITE_` vars to the browser, so the OpenCode key never reaches the client bundle. See `supabase/functions/jimbot/README.md` for the full list.

Hybrid vector search is optional. To enable it, put an OpenRouter key in `EMBEDDING_API_KEY` in `.env.local`, then run `pnpm embed:businesses` once. It defaults to `nvidia/nemotron-3.5-embed-1b:free`; the model's 2048-dimension output is truncated to 1536 to match the existing `business_embeddings` column, so no database migration is required. Without a key, Jimbot falls back to `ilike` text search.

Run the app and checks:

```sh
pnpm dev
pnpm test:jimbot
pnpm test:auth
pnpm build
```

Vite uses port `8443` by default. `pnpm build` runs the `prebuild` hook, which runs both tests before `vite build`. `pnpm format` runs Oxfmt; when formatting an existing file, pass only the intended file paths to avoid unrelated formatting churn.

The Vite configuration imports `.figma/make/site.json`. If this generated Figma Make configuration is missing, Vite cannot load its config; restore it from the project environment before debugging app code or running the Vite-based tests.

## Maintenance map

| To change... | Start here |
| --- | --- |
| App bootstrap, theme-before-paint, service worker | `src/main.tsx` |
| Global providers | `src/app/App.tsx` |
| Route paths and route-level layouts | `src/app/routes.tsx` |
| Traveler account, auth/session, profile, and preferences | `src/app/account.tsx`, `src/lib/authFlow.ts`, `src/lib/passwordAuth.ts` |
| Traveler saved state and itinerary/Moments state | `src/app/store.tsx`, `src/lib/usePersistentState.ts` |
| Tagalog/English language selection | `src/app/i18n.tsx` |
| Supabase browser client | `src/lib/supabase.ts` |
| Traveler home, search, itinerary, and business profile | `src/screens/` |
| Traveler business comments/reviews/profile presentation | `src/screens/DatabaseBusinessProfile.tsx` |
| Moments camera, save flow, map, and gallery | `src/screens/moments/MomentsCamera.tsx`, `src/screens/moments/MomentsMap.tsx`, `src/screens/moments/FloatingGallery.tsx`, `src/screens/moments/useCamera.ts` |
| Business dashboard workspace and app shell | `src/biz/store.tsx`, `src/biz/Shell.tsx` |
| Business posts and media uploads | `src/biz/pages/Composer.tsx`, `src/biz/db/posts.ts`, `src/biz/db/assets.ts` |
| Business reviews, comments, reservations, and other data operations | The matching helper in `src/biz/db/` |
| Developer console | `src/dev/console/` |
| Shared skeleton/loading states | `src/components/ui/Skeleton.tsx` and the relevant screen |
| Database tables, RLS, and Storage policies | `supabase/schema.sql`, `supabase/migrations/` |
| PWA, Vercel routing, or build setup | `public/`, `vercel.json`, `vite.config.ts` |
| Jimbot intent/conversation behavior | `src/screens/Jimbot.tsx`, `src/biz/pages/JimbotChat.tsx`, `tests/jimbot-intents.mjs` |

### Review checklist

- Trace the route to the screen and then to its state/data helper before changing a feature.
- Keep user-facing text consistent with the selected language (Tagalog and English).
- Use an explicit loading state and surface actionable errors for asynchronous data and media flows.
- Keep private media access aligned with Storage RLS; persist Storage paths, not temporary browser URLs.
- Run the focused test for the changed behavior, then run `pnpm build` when the Vite configuration is available.
- Add Taglish code comments for non-obvious lifecycle, persistence, route, or security behavior; avoid comments that merely repeat what a line already says.
