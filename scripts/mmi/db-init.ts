import { ensureProjectTable } from "@/mmi/lib/project-store";

async function main() {
  await ensureProjectTable();
  console.log("MMI database schema is ready.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
