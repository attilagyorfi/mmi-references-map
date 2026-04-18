# MMI References Map Handover

## Current Local App

The MMI project is now separated from NatureQuest.

- Project folder: `C:\Users\User\Desktop\mmi`
- Presentation route: `/`
- Admin route: `/admin`
- Dataset: `public/mmi-data/projects.json`
- Category colors: `public/mmi-data/categories.json`
- Local images: `public/mmi-data/images/<project-id>/`
- World map: `public/mmi-data/world-countries.geojson`

## Local Commands

Run these from `C:\Users\User\Desktop\mmi`:

```powershell
corepack pnpm install
corepack pnpm run mmi:ingest
corepack pnpm run mmi:validate
corepack pnpm run mmi:pwa-assets
corepack pnpm run test:mmi
corepack pnpm run dev
```

Open:

```text
http://localhost:3002
http://localhost:3002/admin
```

## Admin Login

The admin API accepts HTTP Basic credentials.

Admin credentials are read from environment variables:

```text
MMI_ADMIN_EMAIL=...
MMI_ADMIN_PASSWORD=...
```

Use `.env.example` as a template. Do not commit real credentials.

## Desktop Use

The app is now a Progressive Web App. Chromium-based browsers can install it as a standalone desktop-style app:

1. Start the local or hosted server.
2. Open `http://localhost:3002` or the production URL.
3. Click `Install app` in the top bar, or use the browser menu and choose install app.
4. The app opens later from its own desktop/start-menu icon.

Offline behavior:

- `public/sw.js` registers the service worker.
- `public/mmi-data/pwa-assets.json` lists the app shell, local JSON data, map layer, app icons, and first image for each project.
- Full project gallery images are cached when they are first opened.
- After changing project data or images, run `corepack pnpm run mmi:pwa-assets` before building/deploying.

For a true packaged `.exe`, wrap this route with Electron or Tauri and point it at the built Next app. The current code is ready for that because normal presentation usage reads only static local JSON and images.

## Website Integration

Recommended integration path:

1. Keep `public/mmi-data/projects.json`, `categories.json`, images, and `world-countries.geojson` as static assets.
2. Mount the React app as a dedicated route on the company website, for example `/references-map`.
3. Move admin writes to the website backend or CMS.
4. Replace the temporary Basic auth with the website's production authentication.

The presentation map does not need runtime scraping. Rebuild the dataset with `mmi:ingest`, then deploy the generated static assets.
