import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inferCategory } from "@/mmi/lib/classification";
import {
  dedupeStrings,
  inferCountryFromCoordinates,
  normalizeCountryFromLocation,
  parseYearLabel,
} from "@/mmi/lib/normalization";

describe("MMI normalization", () => {
  it("parses closed and open year labels", () => {
    assert.deepEqual(parseYearLabel("2020 - 2021"), {
      yearLabel: "2020 - 2021",
      yearFrom: 2020,
      yearTo: 2021,
    });

    assert.deepEqual(parseYearLabel("1994-"), {
      yearLabel: "1994-",
      yearFrom: 1994,
      yearTo: null,
    });
  });

  it("normalizes Hungarian and English country names from location text", () => {
    assert.equal(
      normalizeCountryFromLocation("Királyegyháza, Baranya, Magyarország")
        ?.country,
      "Hungary",
    );

    assert.equal(
      normalizeCountryFromLocation("Harburg, Bavaria, Germany")?.country,
      "Germany",
    );

    assert.equal(normalizeCountryFromLocation("Solihull, UK")?.country, "United Kingdom");
  });

  it("infers countries from project coordinates when location text is missing", () => {
    assert.equal(inferCountryFromCoordinates(47.156899, 18.136585)?.country, "Hungary");
    assert.equal(inferCountryFromCoordinates(41.917001, 44.419452)?.country, "Georgia");
    assert.equal(inferCountryFromCoordinates(-6.814509, 111.885081)?.country, "Indonesia");
  });

  it("deduplicates strings while preserving the first useful value", () => {
    assert.deepEqual(dedupeStrings([" a.jpg ", "b.jpg", "a.jpg", ""]), [
      "a.jpg",
      "b.jpg",
    ]);
  });

  it("infers a single presentation category from project content", () => {
    assert.equal(inferCategory("BMW - Debrecen plant", ""), "Automotive");
    assert.equal(inferCategory("Királyegyháza Cement Plant", ""), "Cement Industry");
    assert.equal(inferCategory("MNÁMK - Sports hall", ""), "Sports");
    assert.equal(inferCategory("Unknown reference", ""), "Other");
  });
});
