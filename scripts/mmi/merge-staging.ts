import path from "node:path";

import type { MmiDataset, MmiProject } from "@/mmi/types";

import {
  buildImportedProject,
  refreshImportedProject,
  type ExcelProjectRecord,
  type IndexedImage,
  type ProjectMatch,
  readDataset,
  readJson,
  STAGING_DIR,
  writeJson,
} from "./pipeline-lib";

type CopyPlanItem = {
  project_id: string;
  staging_id: string;
  mode: "existing" | "new";
  image_paths: string[];
};

async function main() {
  const dataset = await readDataset();
  const records = await readJson<ExcelProjectRecord[]>(
    path.join(STAGING_DIR, "excel-projects.enriched.json"),
  );
  const matches = await readJson<ProjectMatch[]>(path.join(STAGING_DIR, "match-report.json"));
  const images = await readJson<IndexedImage[]>(path.join(STAGING_DIR, "image-index.json"));
  const imageIndex = new Map(images.map((image) => [image.id, image]));
  const recordIndex = new Map(records.map((record) => [record.staging_id, record]));

  const previewProjectsById = new Map<string, MmiProject>();
  for (const project of structuredClone(dataset.projects)) {
    previewProjectsById.set(project.id, project);
  }
  const copyPlan: CopyPlanItem[] = [];

  for (const match of matches) {
    if (match.decision === "needs_review") {
      continue;
    }

    const record = recordIndex.get(match.staging_id);
    if (!record) {
      continue;
    }

    const matchedImages = match.image_ids
      .map((id) => imageIndex.get(id))
      .filter((image): image is IndexedImage => Boolean(image));

    if (match.decision === "matched_existing" && match.matched_project_id) {
      const project = previewProjectsById.get(match.matched_project_id);
      if (!project) {
        continue;
      }

      if (project.id.startsWith("excel-")) {
        previewProjectsById.set(project.id, refreshImportedProject(project, record));
      } else {
        project.tags = [...new Set([...project.tags, "excel-import"])];
      }

      copyPlan.push({
        project_id: project.id,
        staging_id: record.staging_id,
        mode: "existing",
        image_paths: matchedImages.map((image) => image.full_path),
      });
      continue;
    }

    const newProject = buildImportedProject(record, []);
    previewProjectsById.set(newProject.id, newProject);
    copyPlan.push({
      project_id: newProject.id,
      staging_id: record.staging_id,
      mode: "new",
      image_paths: matchedImages.map((image) => image.full_path),
    });
  }

  const previewProjects = [...previewProjectsById.values()];

  const previewDataset: MmiDataset = {
    ...dataset,
    metadata: {
      ...dataset.metadata,
      generated_at: new Date().toISOString(),
      project_count: previewProjects.length,
    },
    projects: previewProjects.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true })),
  };

  await writeJson(path.join(STAGING_DIR, "merged-projects.preview.json"), previewDataset);
  await writeJson(path.join(STAGING_DIR, "copy-plan.json"), copyPlan);

  console.log(
    `Merge preview complete: ${copyPlan.length} records prepared, ${previewProjects.length} total projects`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
