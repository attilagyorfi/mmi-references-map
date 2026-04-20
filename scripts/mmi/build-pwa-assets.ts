import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MmiDataset } from "@/mmi/types";

const publicDir = path.join(process.cwd(), "public");
const dataDir = path.join(publicDir, "mmi-data");
const projectsPath = path.join(dataDir, "projects.json");
const outputPath = path.join(dataDir, "pwa-assets.json");

async function main() {
  const dataset = JSON.parse(await readFile(projectsPath, "utf8")) as MmiDataset;
  const thumbnailPaths = dataset.projects
    .map((project) => project.images.find((image) => image.local_path)?.local_path)
    .filter((item): item is string => Boolean(item));

  const assets = unique([
    "/",
    "/admin",
    "/api/mmi/projects",
    "/mmi-data/projects.json",
    "/mmi-data/categories.json",
    "/mmi-data/world-countries.geojson?v=natural-earth-50m-2026-04-20",
    "/mmi-data/mmi-logo-30ev.png",
    "/mmi-data/mmi-app.webmanifest",
    "/icons/mmi-icon-192.png",
    "/icons/mmi-icon-512.png",
    ...thumbnailPaths,
  ]);

  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        strategy: "Core app assets and first project thumbnails are pre-cached. Full galleries are cached on first view.",
        assets,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`PWA asset manifest written: ${assets.length} assets`);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
