import path from "node:path";

import {
  type ExcelProjectRecord,
  type IndexedImage,
  type ProjectMatch,
  type ReviewItem,
  readDataset,
  readJson,
  readJsonIfExists,
  scoreImageMatch,
  scoreProjectMatch,
  STAGING_DIR,
  writeJson,
} from "./pipeline-lib";

type ManualOverride = {
  staging_id: string;
  decision?: "matched_existing" | "new_project" | "needs_review";
  matched_project_id?: string | null;
  image_paths?: string[];
  notes?: string[];
};

async function main() {
  const records = await readJson<ExcelProjectRecord[]>(
    path.join(STAGING_DIR, "excel-projects.enriched.json"),
  );
  const images = await readJson<IndexedImage[]>(path.join(STAGING_DIR, "image-index.json"));
  const dataset = await readDataset();
  const overrides = await readJsonIfExists<ManualOverride[]>(
    path.join(STAGING_DIR, "manual-overrides.json"),
    [],
  );
  const overrideByStagingId = new Map(overrides.map((item) => [item.staging_id, item]));
  const imageByPath = new Map(images.map((image) => [image.full_path, image]));

  const matches: ProjectMatch[] = [];
  const review: ReviewItem[] = [];

  for (const record of records) {
    const rankedProjects = dataset.projects
      .map((project) => ({
        project,
        score: scoreProjectMatch(record, project),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    const bestProject = rankedProjects[0];
    const imageCandidates = images
      .map((image) => ({
        image,
        score: scoreImageMatch(record, image, bestProject?.project ?? null),
      }))
      .filter((item) => item.score >= 3)
      .sort((a, b) => b.score - a.score);

    const chosenImages = imageCandidates
      .filter((item, index, items) => {
        if (index > 5) {
          return false;
        }
        if (index === 0) {
          return true;
        }
        return item.score >= Math.max(items[0]?.score - 1, 3);
      })
      .map((item) => item.image);

    let decision: ProjectMatch["decision"] = "new_project";
    let confidence = 0.5;
    let matchedProjectId: string | null = null;
    let matchedProjectTitle: string | null = null;
    const notes: string[] = [];

    if (bestProject && bestProject.score >= 7) {
      decision = "matched_existing";
      confidence = Math.min(0.99, 0.55 + bestProject.score / 15);
      matchedProjectId = bestProject.project.id;
      matchedProjectTitle = bestProject.project.title;
      notes.push(`Matched existing project with score ${bestProject.score}.`);
    } else if (bestProject && bestProject.score >= 4) {
      decision = "needs_review";
      confidence = 0.5;
      matchedProjectId = bestProject.project.id;
      matchedProjectTitle = bestProject.project.title;
      notes.push(`Possible existing project match with score ${bestProject.score}.`);
    } else {
      notes.push("No strong existing project match found.");
    }

    if (chosenImages.length === 0) {
      notes.push("No confident image match found.");
    } else {
      notes.push(`${chosenImages.length} image(s) selected.`);
    }

    if (record.latitude == null || record.longitude == null) {
      decision = "needs_review";
      notes.push("Missing coordinates from Google Maps link.");
    }

    const override = overrideByStagingId.get(record.staging_id);
    if (override) {
      if (override.image_paths) {
        const overrideImages = override.image_paths
          .map((imagePath) => imageByPath.get(imagePath))
          .filter((image): image is IndexedImage => Boolean(image));
        chosenImages.length = 0;
        chosenImages.push(...overrideImages);
      }

      if (override.decision) {
        decision = override.decision;
      }

      if (override.matched_project_id !== undefined) {
        matchedProjectId = override.matched_project_id;
        matchedProjectTitle =
          dataset.projects.find((project) => project.id === override.matched_project_id)?.title ?? null;
      }

      if (override.notes?.length) {
        notes.push(...override.notes);
      }
    }

    matches.push({
      staging_id: record.staging_id,
      decision,
      confidence,
      matched_project_id: matchedProjectId,
      matched_project_title: matchedProjectTitle,
      image_ids: chosenImages.map((image) => image.id),
      image_paths: chosenImages.map((image) => image.full_path),
      notes,
    });

    if (decision === "needs_review") {
      review.push({
        staging_id: record.staging_id,
        short_name: record.source_excel_short_name,
        label: record.source_excel_label,
        reasons: notes,
        candidate_project_ids: rankedProjects.slice(0, 3).map((item) => item.project.id),
        candidate_image_paths: imageCandidates.slice(0, 5).map((item) => item.image.full_path),
      });
    }
  }

  await writeJson(path.join(STAGING_DIR, "match-report.json"), matches);
  await writeJson(path.join(STAGING_DIR, "review-needed.json"), review);
  console.log(
    `Project matching complete: ${matches.length} rows, ${review.length} need review`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
