import path from "node:path";
import { readdir } from "node:fs/promises";

import {
  type IndexedImage,
  ensureStagingDir,
  getImageAliasTerms,
  IMAGES_ROOT,
  normalizeKey,
  STAGING_DIR,
  writeJson,
} from "./pipeline-lib";

async function main() {
  await ensureStagingDir();
  const files = await collectFiles(IMAGES_ROOT);

  const indexed: IndexedImage[] = files
    .filter((filePath) => !filePath.toLowerCase().endsWith("thumbs.db"))
    .filter((filePath) => /\.(jpg|jpeg|png|webp)$/i.test(filePath))
    .map((filePath, index) => {
      const parsed = path.parse(filePath);
      const relative = path.relative(IMAGES_ROOT, filePath).split(path.sep);
      const categoryFolder = relative[0] ?? null;
      const projectFolder =
        relative.length > 2 ? relative[1] : relative.length === 2 ? relative[0] : null;
      return {
        id: `img-${index + 1}`,
        filename: parsed.base,
        stem: parsed.name,
        extension: parsed.ext,
        full_path: filePath,
        category_folder: categoryFolder,
        project_folder: projectFolder,
        normalized_terms: normalizeKey(parsed.name).split(" ").filter(Boolean),
        alias_terms: getImageAliasTerms(parsed.name),
      } satisfies IndexedImage;
    });

  await writeJson(path.join(STAGING_DIR, "image-index.json"), indexed);
  console.log(`Image indexing complete: ${indexed.length} images`);
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }

  return results;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
