import path from "node:path";

import type { MmiDataset } from "@/mmi/types";

import {
  copyImagesForProject,
  DATASET_PATH,
  type IndexedImage,
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
  const preview = await readJson<MmiDataset>(path.join(STAGING_DIR, "merged-projects.preview.json"));
  const copyPlan = await readJson<CopyPlanItem[]>(path.join(STAGING_DIR, "copy-plan.json"));
  const imageIndex = await readJson<IndexedImage[]>(path.join(STAGING_DIR, "image-index.json"));
  const imageByPath = new Map(imageIndex.map((image) => [image.full_path, image]));

  for (const item of copyPlan) {
    const project = preview.projects.find((entry) => entry.id === item.project_id);
    if (!project || item.image_paths.length === 0) {
      continue;
    }

    const indexedImages = item.image_paths
      .map((imagePath) => imageByPath.get(imagePath))
      .filter((image): image is IndexedImage => Boolean(image));
    const copiedImages = await copyImagesForProject(project.id, indexedImages);

    project.images = dedupeImages([...project.images, ...copiedImages], project.title);
  }

  preview.metadata.generated_at = new Date().toISOString();
  preview.metadata.project_count = preview.projects.length;

  await writeJson(path.join(STAGING_DIR, "projects.merged.json"), preview);
  await writeJson(DATASET_PATH, preview);
  console.log(`Image copy + dataset apply complete: ${preview.projects.length} projects`);
}

function dedupeImages(images: MmiDataset["projects"][number]["images"], alt: string) {
  const seen = new Set<string>();
  return images.filter((image) => {
    const key = image.local_path ?? image.url;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    image.alt = image.alt || alt;
    return true;
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
