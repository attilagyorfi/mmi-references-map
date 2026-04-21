import path from "node:path";

import * as XLSX from "xlsx";

import {
  EXCEL_PATH,
  type ExcelProjectRecord,
  ensureStagingDir,
  parseExcelLabel,
  resolveGoogleMapsUrl,
  STAGING_DIR,
  writeJson,
} from "./pipeline-lib";
import { inferCountryFromCoordinates, parseLocationParts } from "@/mmi/lib/normalization";

async function main() {
  await ensureStagingDir();
  const workbook = XLSX.readFile(EXCEL_PATH);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Array<string | null>>(worksheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  const records: ExcelProjectRecord[] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const [shortName, label, mapUrl] = rows[index];
    if (!shortName && !label && !mapUrl) {
      continue;
    }

    const parsed = parseExcelLabel(label);
    const resolvedMap = await resolveGoogleMapsUrl(mapUrl);
    const parsedLocation = parseLocationParts(parsed.locationRaw);
    const inferredCountry = inferCountryFromCoordinates(
      resolvedMap.coordinates?.[0] ?? null,
      resolvedMap.coordinates?.[1] ?? null,
    );

    records.push({
      staging_id: `row-${index + 1}`,
      source_row: index + 1,
      source_excel_short_name: String(shortName ?? "").trim(),
      source_excel_label: String(label ?? "").trim(),
      source_google_maps_url: typeof mapUrl === "string" ? mapUrl.trim() : null,
      category_raw: parsed.categoryRaw,
      project_label_raw: parsed.projectLabelRaw,
      location_raw: parsed.locationRaw,
      latitude: resolvedMap.coordinates?.[0] ?? null,
      longitude: resolvedMap.coordinates?.[1] ?? null,
      country_candidate: parsedLocation.country?.country ?? inferredCountry?.country ?? null,
      city_candidate: parsedLocation.city,
      region_candidate: parsedLocation.region,
      country_code_candidate:
        parsedLocation.country?.countryCode ?? inferredCountry?.countryCode ?? null,
      continent_candidate: parsedLocation.country?.continent ?? inferredCountry?.continent ?? null,
      final_maps_url: resolvedMap.finalUrl,
      source_status:
        resolvedMap.coordinates || parsedLocation.country ? "resolved" : "needs_review",
    });
  }

  await writeJson(path.join(STAGING_DIR, "excel-projects.enriched.json"), records);
  console.log(`Excel import complete: ${records.length} rows`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
