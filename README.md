# Tapza Internal Portal

An internal team portal for Tapza. Ships as a unified workspace with role-specific hubs (QA, Dev, Design, PM, Sales, Founder) and a shared bug tracker that threads through all of them. Built on Next.js 16 App Router, NextAuth v5, and Neon Postgres.

Access is gated to Tapza Google Workspace accounts (any `tapza.*` domain).

## Features

- **Bug tracker** — kanban board with 5-column pagination, PR-to-bug creation, per-bug activity log and comments, custom statuses/priorities/severities, related-bug linking
- **Role hubs** — dashboards and APIs scoped to role: [qa-hub](app/qa-hub), [pm-hub](app/pm-hub), [design-hub](app/design-hub), [sales-hub](app/sales-hub), [founder-hub](app/founder-hub)
- **Team** — profile management, custom avatar uploads, role assignment per profile
- **Analytics** — charts over bug velocity, resolution time, assignee load
- **Auth** — Google OAuth restricted to `tapza.*` domains, server-side session gating in [proxy.js](proxy.js) and API routes via [lib/requireAuth.js](lib/requireAuth.js)
- **Notifications** — per-user feed with unread counts, polled with exponential backoff

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19, Framer Motion, lucide-react |
| Auth | NextAuth v5 (beta) — Google provider, JWT sessions |
| Database | Neon serverless Postgres (`@neondatabase/serverless`) |
| Storage | Vercel Postgres driver available (`@vercel/postgres`) |

> Heads-up: this project pins **Next.js 16** and **NextAuth v5**. APIs and file conventions differ from older versions — consult `node_modules/next/dist/docs/` before making changes.

## Getting Started

### 1. Install

```bash
npm install
```

### 2. Configure environment

Create `.env.local` in the project root:

```bash
# Google OAuth — must be a Google Cloud project with authorized redirect:
#   http://localhost:3000/api/auth/callback/google
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# NextAuth v5 secret (generate: openssl rand -base64 32)
AUTH_SECRET=your-random-secret

# Neon Postgres connection string
DATABASE_URL=postgres://user:password@host/db?sslmode=require
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated requests are redirected to `/signin`.

### 4. Initialize the database

After your first successful sign-in, hit `/api/db-init` (GET) in the browser to create the required tables and seed default settings. It's idempotent — safe to run again after schema changes.

Tables created:

- `bugs` — all bug records with JSONB activity log, comments, PR links
- `notifications` — per-user notification feed
- `settings` — singleton row (id=1) with assignees, statuses, priorities, projects, severities
- `design_resources` — per-user design hub links
- `sales_customers` — per-owner sales pipeline

## Project Layout

```
app/
  api/              # Route handlers (auth, bugs, settings, hub-specific endpoints)
  components/       # Shared client components (AuthProvider, AppShell, dashboards)
  signin/           # Public sign-in page (server component)
  auth/error/       # OAuth error page (domain restriction etc.)
  bugs/             # Kanban + list views
  analytics/        # Charts and metrics
  projects/         # Project admin
  team/             # Team directory
  profile/          # Current-user profile
  settings/         # Tenant settings
  {qa,pm,design,sales,founder}-hub/
auth.js             # NextAuth v5 config (Google + domain gate)
proxy.js            # Middleware: redirects/401s unauthenticated traffic
lib/requireAuth.js  # API-route auth gate
```

## Auth Model

- Only users whose Google account hosted-domain (`hd`) or email domain matches `^tapza\.[a-z.]+$` are allowed in. See [auth.js](auth.js#L5).
- Non-Tapza accounts are redirected to `/auth/error?error=DomainRestricted`.
- Server-side enforcement lives in [proxy.js](proxy.js) (pages + API) and [lib/requireAuth.js](lib/requireAuth.js) (defense-in-depth for API handlers).
- The root layout calls `auth()` server-side and hydrates `SessionProvider`, so the client doesn't need to refetch `/api/auth/session` on mount.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint (flat config in `eslint.config.mjs`) |

## Deployment

Vercel is the intended target. Required environment variables:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `DATABASE_URL` (Neon)
- `AUTH_URL` or `NEXTAUTH_URL` if your deployment URL differs from the OAuth callback origin

After deploying, run `/api/db-init` once to provision tables on the target database.
