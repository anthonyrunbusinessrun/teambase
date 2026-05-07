# TeamBase

Internal company operating system. Mobile-first, production-ready.

Built with Next.js 15, Better Auth, Drizzle ORM, PostgreSQL, and Airtable.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 15 App Router |
| Auth | Better Auth (magic link + email/password) |
| Database | PostgreSQL via Drizzle ORM |
| External data | Airtable API |
| Email | Resend |
| Deployment | Railway |
| Styling | Tailwind CSS + shadcn/ui |

---

## Local setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`. Required:

- `DATABASE_URL` — PostgreSQL connection string
- `BETTER_AUTH_SECRET` — generate with `openssl rand -hex 32`
- `BETTER_AUTH_URL` — `http://localhost:3000` for local dev
- `ALLOWED_EMAIL_DOMAIN` — your company domain, e.g. `company.com`
- `AIRTABLE_API_KEY` — personal access token from airtable.com/create/tokens
- `AIRTABLE_BASE_ID` — from your Airtable base URL
- `RESEND_API_KEY` — from resend.com
- `EMAIL_FROM` — sender address, e.g. `TeamBase <no-reply@company.com>`

### 3. Run database migrations

```bash
npm run db:push
```

Or generate and run SQL migration files:

```bash
npm run db:generate
npm run db:migrate
```

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Railway deployment

### 1. Create project

- Go to [railway.app](https://railway.app) → New Project
- Deploy from GitHub → select `anthonyrunbusinessrun/teambase`

### 2. Add PostgreSQL

- In your Railway project → Add Service → Database → PostgreSQL
- Railway auto-sets `DATABASE_URL` in your app service

### 3. Set environment variables

In Railway dashboard → your app service → Variables, add:

```
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_URL=https://<your-railway-domain>.up.railway.app
ALLOWED_EMAIL_DOMAIN=yourdomain.com
AIRTABLE_API_KEY=pat...
AIRTABLE_BASE_ID=app...
RESEND_API_KEY=re_...
EMAIL_FROM=TeamBase <no-reply@yourdomain.com>
SYNC_SECRET=<openssl rand -hex 16>
NEXT_PUBLIC_APP_URL=https://<your-railway-domain>.up.railway.app
```

### 4. Run migrations on deploy

In Railway → your service → Settings → Deploy → add a Pre-deploy command:

```
npm run db:migrate
```

### 5. Deploy

Push to `main`. Railway auto-deploys.

---

## Airtable setup

### Update table names

Edit `lib/airtable/tables.ts` to match your actual Airtable table and field names.

### Sync employees

Trigger a one-time sync after deployment:

```bash
curl -X POST https://your-domain.up.railway.app/api/airtable/sync?type=employees \
  -H "x-sync-secret: YOUR_SYNC_SECRET"
```

---

## Project structure

```
app/
  (auth)/login/          # Magic link login page
  (app)/dashboard/       # Home dashboard
  (app)/clocks/          # World clocks (Austin, Manila, Cebu, UTC)
  (app)/presence/        # Team presence tracking
  (app)/tasks/           # Task list + detail + new task
  api/auth/              # Better Auth handler
  api/presence/          # Presence heartbeat API
  api/airtable/sync/     # Airtable sync endpoint

components/
  layout/                # AppShell, TopBar, BottomNav, BackButton
  clocks/                # WorldClock (live, per-timezone)
  presence/              # PresenceCard, PresenceHeartbeat
  tasks/                 # TaskCard, TaskForm, NewTaskForm

lib/
  auth/                  # Better Auth instance + client
  db/                    # Drizzle client + schema + migrations
  airtable/              # Typed client, table constants, sync service
  actions/               # Server actions (tasks, presence)
  validations/           # Zod schemas
  env.ts                 # Environment validation (fails fast if missing)
  utils.ts               # cn() utility

middleware.ts            # Auth guard — redirects unauthenticated users
```

---

## Key decisions

**Better Auth over Auth.js** — ships PostgreSQL adapters, magic link, and domain restriction natively with cleaner TypeScript ergonomics.

**Drizzle over Prisma** — migrations are plain SQL files you own. No runtime overhead.

**Airtable as a service layer** — all Airtable access goes through `lib/airtable/client.ts`. The UI never talks to Airtable directly. Sync important data to PostgreSQL to reduce API dependency.

**Polling over WebSockets** — 30-second presence polling is sufficient for an internal tool. Pusher or Ably can be added later without architectural changes.

**Server Components by default** — client components only where interactivity is required (forms, live clocks, heartbeat).

---

## Scripts

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run db:generate  # Generate Drizzle migration files
npm run db:migrate   # Run migrations
npm run db:push      # Push schema directly (dev only)
npm run db:studio    # Open Drizzle Studio
```

---

## Adding shadcn/ui components

```bash
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add toast
```

Components install into `components/ui/` as owned source files.
