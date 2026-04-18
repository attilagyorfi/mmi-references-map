import { exportDatabaseToJson } from "@/mmi/lib/project-store";

async function main() {
  const dataset = await exportDatabaseToJson();
  console.log(`MMI database export complete: ${dataset.projects.length} projects.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
