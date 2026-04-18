import type { MmiCategory } from "@/mmi/types";

const CATEGORY_RULES: Array<{
  category: MmiCategory;
  terms: string[];
}> = [
  {
    category: "Cement Industry",
    terms: ["cement", "clinker", "zement", "ceminvest", "ddc", "heidelberg"],
  },
  {
    category: "Automotive",
    terms: ["bmw", "schaeffler", "continental", "savaria", "luk", "opel", "volkswagen", "vehicle", "automotive"],
  },
  {
    category: "Food Industry",
    terms: ["nestle", "nestlé", "food", "sunflower", "flour", "malom", "sugar", "cukor", "grain", "agrograin", "yeast"],
  },
  {
    category: "Logistics / Warehouse",
    terms: ["warehouse", "logistic", "logistics", "high-bay", "storage", "silo", "raktár"],
  },
  {
    category: "Sports",
    terms: ["arena", "sports hall", "stadium", "gymnasium", "sportcsarnok"],
  },
  {
    category: "Healthcare",
    terms: ["hospital", "health", "kórház", "medical"],
  },
  {
    category: "Education",
    terms: ["school", "training facility", "university", "mnámk", "tanüzem"],
  },
  {
    category: "Energy / Utilities",
    terms: ["biomass", "energy", "power", "water tower", "utilities", "víztorony"],
  },
  {
    category: "Mining / Materials",
    terms: ["quarry", "kőbánya", "mining", "materials", "kronospan", "osb", "falco", "mofa"],
  },
  {
    category: "Residential",
    terms: ["residential", "house", "lakópark", "ház", "court"],
  },
  {
    category: "Office / Business",
    terms: ["office", "business park", "infopark", "iroda", "post"],
  },
  {
    category: "Public / Civic",
    terms: ["police", "arboretum", "public", "civic", "zoo", "cat complex", "rendőr", "posta"],
  },
  {
    category: "Industrial",
    terms: ["plant", "factory", "production", "hall", "industrial", "üzem", "gyár", "csarnok"],
  },
];

export function inferCategory(
  title: string | null | undefined,
  description: string | null | undefined,
  workType?: string | null,
): MmiCategory {
  const haystack = `${title ?? ""} ${description ?? ""} ${workType ?? ""}`.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.terms.some((term) => haystack.includes(term))) {
      return rule.category;
    }
  }

  return "Other";
}
