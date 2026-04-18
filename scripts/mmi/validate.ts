import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { MmiDatasetSchema } from "@/mmi/lib/schema";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const DATASET_PATH = path.join(PROJECT_ROOT, "public", "mmi-data", "projects.json");

async function main() {
  const raw = await readFile(DATASET_PATH, "utf8");
  const dataset = MmiDatasetSchema.parse(JSON.parse(raw));
  const withoutCountry = dataset.projects.filter((project) => !project.country);
  const withoutCoordinates = dataset.projects.filter(
    (project) => project.latitude == null || project.longitude == null,
  );

  if (withoutCountry.length > 0) {
    console.warn(
      `Projects without normalized country: ${withoutCountry.map((project) => project.id).join(", ")}`,
    );
  }

  if (withoutCoordinates.length > 0) {
    console.warn(
      `Projects without coordinates: ${withoutCoordinates.map((project) => project.id).join(", ")}`,
    );
  }

  console.log(`MMI dataset valid: ${dataset.projects.length} projects`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
