import { NextResponse } from "next/server";

import { isAuthorized } from "@/mmi/lib/admin-auth";
import { readProjectDataset, upsertProject } from "@/mmi/lib/project-store";
import { MmiProjectSchema } from "@/mmi/lib/schema";
import type { MmiProject } from "@/mmi/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const dataset = await readProjectDataset();
  return NextResponse.json(dataset);
}

export async function PUT(request: Request) {
  if (!isAuthorized(request)) {
    return unauthorized();
  }

  const body = await request.json();
  const project = MmiProjectSchema.parse(body.project) as MmiProject;
  const nextDataset = await upsertProject(project);
  return NextResponse.json(nextDataset);
}
