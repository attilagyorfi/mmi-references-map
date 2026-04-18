import { readFile } from "node:fs/promises";
import path from "node:path";

import { replaceAllProjects } from "@/mmi/lib/project-store";
import { MmiDatasetSchema } from "@/mmi/lib/schema";
import type { MmiDataset } from "@/mmi/types";

const projectsPath = path.join(process.cwd(), "public", "mmi-data", "projects.json");

async function main() {
  const dataset = MmiDatasetSchema.parse(
    JSON.parse(await readFile(projectsPath, "utf8")),
  ) as MmiDataset;

  await replaceAllProjects(dataset.projects);
  console.log(`MMI database import complete: ${dataset.projects.length} projects.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
