import test from "node:test";
import assert from "node:assert/strict";

import {
  extractCoordinatesFromUrl,
  refreshImportedProject,
  mapExcelCategory,
  parseExcelLabel,
} from "../../scripts/mmi/pipeline-lib";
import type { MmiProject } from "@/mmi/types";

test("MMI excel pipeline parses category, label, and location from Excel label", () => {
  assert.deepEqual(parseExcelLabel("Cement - DDC Vác - Hungary"), {
    categoryRaw: "Cement",
    projectLabelRaw: "DDC Vác",
    locationRaw: "Hungary",
  });
});

test("MMI excel pipeline extracts coordinates from resolved Google Maps URLs", () => {
  assert.deepEqual(
    extractCoordinatesFromUrl(
      "https://www.google.com/maps/search/32.748485,+-97.364759?entry=tts",
    ),
    [32.748485, -97.364759],
  );
});

test("MMI excel pipeline extracts coordinates when Google Maps encodes spaces with plus signs", () => {
  assert.deepEqual(
    extractCoordinatesFromUrl(
      "https://www.google.com/maps/search/47.567351,+21.525409?entry=tts",
    ),
    [47.567351, 21.525409],
  );
});

test("MMI excel pipeline maps Excel categories to MMI taxonomy", () => {
  assert.equal(mapExcelCategory("Chemical", "Richter Gedeon"), "Industrial");
  assert.equal(mapExcelCategory("Cement", "Power Cement"), "Cement Industry");
  assert.equal(mapExcelCategory("Automotive", "BMW"), "Automotive");
});

test("MMI excel pipeline refreshes stale excel projects with normalized country data", () => {
  const existing: MmiProject = {
    id: "excel-21",
    slug: "21-nitrogenmuvek-petfurdo",
    title: "Nitrogénművek Pétfürdő",
    title_en: "Nitrogénművek Pétfürdő",
    title_hu: "Pét",
    title_zh: null,
    description_hu: null,
    description_en: "Chemical - Nitrogénművek Pétfürdő - Nitrogénművek Pétfürdő",
    description_zh: null,
    year_label: null,
    year_from: null,
    year_to: null,
    location_text: null,
    city: null,
    region: null,
    country: null,
    country_code: null,
    continent: null,
    latitude: 47.156899,
    longitude: 18.136585,
    category_primary: "Industrial",
    category_color: "#526D78",
    work_type: "Chemical",
    investor: null,
    client: null,
    contractor: null,
    project_manager: null,
    source_url: "https://www.google.com/maps/search/47.156899,+18.136585?entry=tts",
    source_url_hu: null,
    images: [],
    tags: ["excel-import", "Chemical", "Nitrogénművek Pétfürdő"],
  };

  const refreshed = refreshImportedProject(existing, {
    staging_id: "row-21",
    source_row: 21,
    source_excel_short_name: "Pét",
    source_excel_label: "Chemical - Nitrogénművek Pétfürdő",
    source_google_maps_url: "https://maps.app.goo.gl/example",
    category_raw: "Chemical",
    project_label_raw: "Nitrogénművek Pétfürdő",
    location_raw: null,
    latitude: 47.156899,
    longitude: 18.136585,
    country_candidate: "Hungary",
    city_candidate: null,
    region_candidate: null,
    country_code_candidate: "HU",
    continent_candidate: "Europe",
    final_maps_url: "https://www.google.com/maps/search/47.156899,+18.136585?entry=tts",
    source_status: "resolved",
  });

  assert.equal(refreshed.country, "Hungary");
  assert.equal(refreshed.country_code, "HU");
  assert.equal(refreshed.continent, "Europe");
});
