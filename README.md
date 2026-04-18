# MMI References Map

Interactive, installable PWA presentation map for M Mérnöki Iroda Kft. references.

## Local Development

```powershell
corepack pnpm install
corepack pnpm run dev
```

Open `http://localhost:3002`.

## Data Workflow

```powershell
corepack pnpm run mmi:ingest
corepack pnpm run mmi:validate
corepack pnpm run mmi:pwa-assets
```

The presentation app reads static data from `public/mmi-data/`.

## Admin And Database Workflow

The admin interface works in two modes:

- Without `DATABASE_URL`, it edits `public/mmi-data/projects.json`. This is convenient for a local demo.
- With `DATABASE_URL`, it reads and writes PostgreSQL. This is the recommended setup for the future own-hosting version.

Prepare a PostgreSQL database:

```powershell
$env:DATABASE_URL="postgresql://mmi_user:mmi_password@localhost:5432/mmi_references"
$env:DATABASE_SSL="false"
corepack pnpm run mmi:db:init
corepack pnpm run mmi:db:import
```

Export database edits back into the static JSON bundle when you want to rebuild the offline/PWA package:

```powershell
corepack pnpm run mmi:db:export
corepack pnpm run mmi:validate
corepack pnpm run mmi:pwa-assets
```

The public map loads `/api/mmi/projects`. If PostgreSQL is configured, the API serves the database content; otherwise it serves the prepared JSON file. The static JSON remains the fallback for offline presentation usage.

## Checks

```powershell
corepack pnpm run lint
corepack pnpm run test:mmi
corepack pnpm run build
```

## Admin Credentials

Admin credentials must be provided through environment variables:

```text
MMI_ADMIN_EMAIL=...
MMI_ADMIN_PASSWORD=...
DATABASE_URL=...
DATABASE_SSL=false
```

Use `.env.example` as a template. Do not commit real credentials.

## Vercel Deployment

Recommended first deployment path:

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Framework preset: Next.js.
4. Install command: `corepack pnpm install`.
5. Build command: `corepack pnpm run build`.
6. Add `MMI_ADMIN_EMAIL`, `MMI_ADMIN_PASSWORD`, and `DATABASE_URL` only if the admin route should be enabled.

Normal presentation usage does not scrape the live website.
