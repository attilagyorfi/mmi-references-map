import { NextResponse } from "next/server";

import { readProjectDataset } from "@/mmi/lib/project-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const dataset = await readProjectDataset();

  return NextResponse.json(dataset, {
    headers: {
      "cache-control": "public, max-age=60, stale-while-revalidate=3600",
    },
  });
}
