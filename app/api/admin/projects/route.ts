import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { isAuthorized } from "@/mmi/lib/admin-auth";
import { MmiDatasetSchema, MmiProjectSchema } from "@/mmi/lib/schema";

export const runtime = "nodejs";

const DATASET_PATH = path.join(
  process.cwd(),
  "public",
  "mmi-data",
  "projects.json",
);

function unauthorized() {
  return NextResponse.json(
    { message: "Unauthorized" },
    { status: 401, headers: { "www-authenticate": "Basic" } },
  );
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return unauthorized();
  }

  const dataset = await readDataset();
  return NextResponse.json(dataset);
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) {
    return unauthorized();
  }

  const body = await request.json();
  const project = MmiProjectSchema.parse(body.project);
  const dataset = await readDataset();
  const index = dataset.projects.findIndex((item) => item.id === project.id);

  const projects =
    index === -1
      ? [...dataset.projects, project]
      : dataset.projects.map((item) => (item.id === project.id ? project : item));

  const nextDataset = MmiDatasetSchema.parse({
    ...dataset,
    metadata: {
      ...dataset.metadata,
      generated_at: new Date().toISOString(),
      project_count: projects.length,
    },
    projects: projects.sort((a, b) => Number(a.id) - Number(b.id)),
  });

  await writeFile(DATASET_PATH, `${JSON.stringify(nextDataset, null, 2)}\n`, "utf8");
  return NextResponse.json(nextDataset);
}

async function readDataset() {
  const raw = await readFile(DATASET_PATH, "utf8");
  return MmiDatasetSchema.parse(JSON.parse(raw));
}
