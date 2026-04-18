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
```

Use `.env.example` as a template. Do not commit real credentials.

## Vercel Deployment

Recommended first deployment path:

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Framework preset: Next.js.
4. Install command: `corepack pnpm install`.
5. Build command: `corepack pnpm run build`.
6. Add `MMI_ADMIN_EMAIL` and `MMI_ADMIN_PASSWORD` in Vercel environment variables if the admin route should be enabled.

Normal presentation usage does not scrape the live website.
