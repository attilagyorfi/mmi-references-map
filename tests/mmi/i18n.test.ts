import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCountryLabel,
  getProjectDescription,
  getProjectTitle,
  getProjectWorkType,
} from "@/mmi/i18n";
import type { MmiProject } from "@/mmi/types";

describe("MMI language fallbacks", () => {
  it("uses Hungarian project title and description when Hungarian is selected", () => {
    const sample = project();
    assert.equal(getProjectTitle(sample, "hu"), "Magyar projekt");
    assert.equal(getProjectDescription(sample, "hu"), "Magyar leírás");
    assert.equal(getCountryLabel("Hungary", "hu"), "Magyarország");
  });

  it("builds a Chinese project description when curated Chinese text is missing", () => {
    const text = getProjectDescription(project(), "zh") ?? "";
    assert.match(text, /该项目/);
    assert.match(text, /项目地点/);
    assert.doesNotMatch(text, /English description/);
    assert.equal(getCountryLabel("Hungary", "zh"), "匈牙利");
  });

  it("localizes work type labels for Hungarian and Chinese detail panels", () => {
    const sample = project({
      work_type: "Structural design, Building permit, Detailed design",
    });

    assert.equal(
      getProjectWorkType(sample, "hu"),
      "Tartószerkezeti tervezés, Engedélyezési terv, Kiviteli tervezés",
    );
    assert.equal(getProjectWorkType(sample, "zh"), "结构设计, 报批设计, 详细设计");
    assert.equal(
      getProjectWorkType(sample, "en"),
      "Structural design, Building permit, Detailed design",
    );
  });

  it("uses curated translations for complete work type phrases", () => {
    const sample = project({
      work_type: "Production design of steel structures",
    });

    assert.equal(getProjectWorkType(sample, "hu"), "Acélszerkezetek gyártmánytervezése");
    assert.equal(getProjectWorkType(sample, "zh"), "钢结构生产设计");
  });
});

function project(overrides: Partial<MmiProject> = {}): MmiProject {
  return {
    id: "1",
    slug: "sample",
    title: "Sample project",
    title_en: "English project",
    title_hu: "Magyar projekt",
    title_zh: null,
    description_hu: "Magyar leírás",
    description_en: "English description",
    description_zh: null,
    year_label: "2024",
    year_from: 2024,
    year_to: 2024,
    location_text: "Budapest, Hungary",
    city: "Budapest",
    region: null,
    country: "Hungary",
    country_code: "HU",
    continent: "Europe",
    latitude: 47.4979,
    longitude: 19.0402,
    category_primary: "Industrial",
    category_color: "#526D78",
    work_type: "Structural design",
    investor: "Investor Ltd.",
    client: "Client Ltd.",
    contractor: null,
    project_manager: null,
    source_url: "https://mmernoki.hu/references/1",
    source_url_hu: null,
    images: [],
    tags: [],
    ...overrides,
  };
}
