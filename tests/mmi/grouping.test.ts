import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { groupProjectsForMap } from "@/mmi/lib/grouping";
import type { MmiProject } from "@/mmi/types";

describe("MMI map grouping", () => {
  it("can group countries and cities for legacy summary views", () => {
    const projects = [
      project("1", "Budapest", 47.4979, 19.0402),
      project("2", "Debrecen", 47.5316, 21.6273),
      project("3", "Budapest", 47.4979, 19.0402),
    ];

    const countryGroups = groupProjectsForMap(projects, "country");
    assert.equal(countryGroups.length, 1);
    assert.equal(countryGroups[0].label, "Hungary");
    assert.equal(countryGroups[0].projects.length, 3);

    const cityGroups = groupProjectsForMap(projects, "city");
    assert.equal(cityGroups.length, 2);
    assert.deepEqual(
      cityGroups.map((group) => `${group.label}:${group.projects.length}`).sort(),
      ["Budapest:2", "Debrecen:1"],
    );
  });

  it("clusters projects that share the same city for map markers", () => {
    const projects = [
      project("1", "Budapest", 47.4979, 19.0402),
      project("2", "Debrecen", 47.5316, 21.6273),
      project("3", "Budapest", 47.4979, 19.0402),
    ];

    const projectGroups = groupProjectsForMap(projects, "project");
    assert.equal(projectGroups.length, 2);
    assert.deepEqual(
      projectGroups.map((group) => `${group.label}:${group.projects.length}`).sort(),
      ["Budapest:2", "Debrecen:1"],
    );
  });
});

function project(
  id: string,
  city: string,
  latitude: number,
  longitude: number,
): MmiProject {
  return {
    id,
    slug: id,
    title: id,
    title_en: id,
    title_hu: null,
    title_zh: null,
    description_hu: null,
    description_en: null,
    description_zh: null,
    year_label: null,
    year_from: null,
    year_to: null,
    location_text: `${city}, Hungary`,
    city,
    region: null,
    country: "Hungary",
    country_code: "HU",
    continent: "Europe",
    latitude,
    longitude,
    category_primary: "Industrial",
    category_color: "#526D78",
    work_type: null,
    investor: null,
    client: null,
    contractor: null,
    project_manager: null,
    source_url: "https://mmernoki.hu/references/1",
    source_url_hu: null,
    images: [],
    tags: [],
  };
}
