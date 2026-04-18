import { CATEGORY_BY_ID } from "@/mmi/lib/categories";
import type { Language, MmiProject } from "@/mmi/types";

export const dictionaries = {
  en: {
    appTitle: "M Mérnöki Iroda Kft.",
    appSubtitle: "International references",
    language: "Language",
    filters: "Filters",
    country: "Country",
    category: "Category",
    allCountries: "All countries",
    allCategories: "All categories",
    legend: "Legend",
    projects: "projects",
    project: "project",
    selectedCountry: "Selected location",
    selectPrompt: "Select a marker to view references.",
    workType: "Work type",
    year: "Year",
    location: "Location",
    investor: "Investor",
    client: "Client",
    contractor: "Contractor",
    projectManager: "Project management",
    source: "Original source",
    images: "Images",
    noImages: "No local images available",
    filtered: "Filtered",
    total: "Total",
    reset: "Reset",
    previousImage: "Previous",
    nextImage: "Next",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    zoomReset: "Reset",
    installApp: "Install app",
    appInstalled: "Installed",
  },
  hu: {
    appTitle: "M Mérnöki Iroda Kft.",
    appSubtitle: "Nemzetközi referenciák",
    language: "Nyelv",
    filters: "Szűrők",
    country: "Ország",
    category: "Kategória",
    allCountries: "Összes ország",
    allCategories: "Összes kategória",
    legend: "Jelmagyarázat",
    projects: "projekt",
    project: "projekt",
    selectedCountry: "Kiválasztott helyszín",
    selectPrompt: "Válasszon ki egy jelölőt a referenciák megtekintéséhez.",
    workType: "Munka jellege",
    year: "Év",
    location: "Helyszín",
    investor: "Beruházó",
    client: "Megrendelő",
    contractor: "Kivitelező",
    projectManager: "Projektmenedzsment",
    source: "Eredeti forrás",
    images: "Képek",
    noImages: "Nincs elérhető helyi kép",
    filtered: "szűrt",
    total: "összesen",
    reset: "Visszaállítás",
    previousImage: "Előző",
    nextImage: "Következő",
    zoomIn: "Nagyítás",
    zoomOut: "Kicsinyítés",
    zoomReset: "Alaphelyzet",
    installApp: "Telepítés",
    appInstalled: "Telepítve",
  },
  zh: {
    appTitle: "M Mérnöki Iroda Kft.",
    appSubtitle: "国际项目业绩",
    language: "语言",
    filters: "筛选",
    country: "国家",
    category: "类别",
    allCountries: "全部国家",
    allCategories: "全部类别",
    legend: "图例",
    projects: "个项目",
    project: "个项目",
    selectedCountry: "选定地点",
    selectPrompt: "请选择地图标记查看项目。",
    workType: "工作内容",
    year: "年份",
    location: "地点",
    investor: "投资方",
    client: "客户",
    contractor: "承包商",
    projectManager: "项目管理",
    source: "原始来源",
    images: "图片",
    noImages: "暂无本地图片",
    filtered: "筛选结果",
    total: "总数",
    reset: "重置",
    previousImage: "上一张",
    nextImage: "下一张",
    zoomIn: "放大",
    zoomOut: "缩小",
    zoomReset: "重置",
    installApp: "安装应用",
    appInstalled: "已安装",
  },
} as const;

export type Dictionary = (typeof dictionaries)[Language];

export function getProjectTitle(project: MmiProject, language: Language): string {
  if (language === "hu") {
    return project.title_hu ?? project.title_en ?? project.title;
  }

  if (language === "zh") {
    return project.title_zh ?? project.title_en ?? project.title_hu ?? project.title;
  }

  return project.title_en ?? project.title_hu ?? project.title;
}

export function getProjectDescription(
  project: MmiProject,
  language: Language,
): string | null {
  if (language === "hu") {
    return project.description_hu ?? buildHungarianFallback(project);
  }

  if (language === "zh") {
    return project.description_zh ?? buildChineseFallback(project);
  }

  return project.description_en ?? project.description_hu;
}

export function getProjectWorkType(project: MmiProject, language: Language): string | null {
  if (!project.work_type) {
    return null;
  }

  if (language === "hu") {
    return translateWorkType(project.work_type, WORK_TYPE_HU);
  }

  if (language === "zh") {
    return translateWorkType(project.work_type, WORK_TYPE_ZH);
  }

  return project.work_type;
}

export function getProjectLocation(project: MmiProject, language: Language): string | null {
  if (!project.location_text) {
    return null;
  }

  const country = project.country ? getCountryLabel(project.country, language) : null;
  return [project.city, project.region, country].filter(Boolean).join(", ");
}

export function getCountryLabel(country: string, language: Language): string {
  if (language === "hu") {
    return COUNTRY_HU[country] ?? country;
  }

  if (language === "zh") {
    return COUNTRY_ZH[country] ?? country;
  }

  return country;
}

export function getCategoryLabel(
  categoryId: MmiProject["category_primary"],
  language: Language,
): string {
  const category = CATEGORY_BY_ID.get(categoryId);
  if (!category) {
    return categoryId;
  }

  if (language === "hu") {
    return category.label_hu;
  }

  if (language === "zh") {
    return category.label_zh;
  }

  return category.label_en;
}

function buildHungarianFallback(project: MmiProject): string {
  const lines = [
    `${getProjectTitle(project, "hu")} referencia.`,
    project.location_text ? `Helyszín: ${project.location_text}.` : null,
    project.year_label ? `Év: ${project.year_label}.` : null,
    project.work_type ? `Munka jellege: ${getProjectWorkType(project, "hu")}.` : null,
    project.client ? `Megrendelő: ${project.client}.` : null,
    project.investor ? `Beruházó: ${project.investor}.` : null,
  ];

  return lines.filter(Boolean).join("\n");
}

function buildChineseFallback(project: MmiProject): string {
  const category = getCategoryLabel(project.category_primary, "zh");
  const lines = [
    `该项目是 M Mérnöki Iroda Kft. 的${category}类参考项目。`,
    project.location_text ? `项目地点：${localizeLocation(project)}。` : null,
    project.year_label ? `项目年份：${project.year_label}。` : null,
    "工作范围包括工程设计、结构相关专业服务或项目资料中列明的其他任务。",
    project.client ? `客户：${project.client}。` : null,
    project.investor ? `投资方：${project.investor}。` : null,
    project.contractor ? `承包商：${project.contractor}。` : null,
    "详细技术说明可在原始项目资料中继续补充中文译文。",
  ];

  return lines.filter(Boolean).join("\n");
}

function localizeLocation(project: MmiProject): string {
  const country = project.country ? getCountryLabel(project.country, "zh") : null;
  return [project.city, project.region, country].filter(Boolean).join(", ");
}

function translateWorkType(value: string, dictionary: Record<string, string>): string {
  return Object.entries(dictionary)
    .sort(([left], [right]) => right.length - left.length)
    .reduce(
      (text, [source, target]) =>
        text.replace(new RegExp(escapeRegExp(source), "gi"), target),
      value,
    );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const WORK_TYPE_HU: Record<string, string> = {
  "A Structural design of all steel structures, including workshop design":
    "Az összes acélszerkezet tartószerkezeti tervezése, beleértve a gyártmánytervezést",
  "Architectural and structural design and production design":
    "Építészeti és tartószerkezeti tervezés, valamint gyártmánytervezés",
  "Architecture, Supporting structure permit plan, construction plan":
    "Építészet, tartószerkezeti engedélyezési terv és kiviteli terv",
  "Complete general design in addition to architectural and structural design":
    "Teljes körű generáltervezés, építészeti és tartószerkezeti tervezéssel",
  "Complete general design, including architectural and structural design":
    "Teljes körű generáltervezés, beleértve az építészeti és tartószerkezeti tervezést",
  "Complete general design, including architectural and structural engineering design":
    "Teljes körű generáltervezés, beleértve az építészeti és tartószerkezeti mérnöki tervezést",
  "Feasibility Study - General Design": "Megvalósíthatósági tanulmány - generáltervezés",
  "Full-scope design, Designs for approval, Tendering and Final designs":
    "Teljes körű tervezés, jóváhagyási tervek, tendertervezés és végleges tervek",
  "Full-scope design, Planning permission, Detailed design":
    "Teljes körű tervezés, engedélyezési terv és kiviteli tervezés",
  "Full-scope planning, Planning Permission Documents, Implementation Documents":
    "Teljes körű tervezés, engedélyezési dokumentáció és kiviteli dokumentáció",
  "General design of supporting structures, Detail design of reinforced concrete structures, Execution plans":
    "Tartószerkezetek generáltervezése, vasbeton szerkezetek részlettervezése és kiviteli tervek",
  "General planning, Building permit plans, Construction plans":
    "Generáltervezés, engedélyezési tervek és kiviteli tervek",
  "General planning, Building permit plans, Construction plans, Tender plans":
    "Generáltervezés, engedélyezési tervek, kiviteli tervek és tendertervek",
  "General, Architecture support structure, Licensing, design, manufacture":
    "Generáltervezés, építészeti tartószerkezet, engedélyezés, tervezés és gyártmánytervezés",
  "General, Architecture, Structural design, Building permit, Detailed design":
    "Generáltervezés, építészet, tartószerkezeti tervezés, engedélyezési terv és kiviteli tervezés",
  "General, Architecture, Structural design, Building permit, Detailed design, Manufacture":
    "Generáltervezés, építészet, tartószerkezeti tervezés, engedélyezési terv, kiviteli tervezés és gyártmánytervezés",
  "General, Architecture, Support structure, Licensing, Detailed design, manufacture":
    "Generáltervezés, építészet, tartószerkezet, engedélyezés, kiviteli tervezés és gyártmánytervezés",
  "Permit, tender & detailed design, site supervision":
    "Engedélyezési terv, tender- és kiviteli tervezés, helyszíni művezetés",
  "Planning Permission Documents, Tender Documents, Implementation Documents":
    "Engedélyezési dokumentáció, tenderdokumentáció és kiviteli dokumentáció",
  "Production design of steel structures": "Acélszerkezetek gyártmánytervezése",
  "Structural and architectural design plans": "Tartószerkezeti és építészeti tervek",
  "Support structure permit, tender and construction design documentation":
    "Tartószerkezeti engedélyezési, tender- és kiviteli tervdokumentáció",
  "Planning Permission Documents": "Engedélyezési dokumentáció",
  "Implementation Documents": "Kiviteli dokumentáció",
  "Implementation plans": "Kiviteli tervek",
  "Execution plans": "Kiviteli tervek",
  "Construction plans": "Kiviteli tervek",
  "Building permit plans": "Engedélyezési tervek",
  "Building permit and design documentation": "Engedélyezési és tervdokumentáció",
  "Building permit": "Engedélyezési terv",
  "Planning permission": "Engedélyezési terv",
  Permission: "Engedélyezés",
  Licensing: "Engedélyezés",
  "Tender Documents": "Tenderdokumentáció",
  "Tender plans": "Tendertervek",
  Tendering: "Tendertervezés",
  Tender: "Tender",
  "Complete general design": "Teljes körű generáltervezés",
  "Full-scope planning": "Teljes körű tervezés",
  "Full-scope design": "Teljes körű tervezés",
  "General planning": "Generáltervezés",
  "General design": "Generáltervezés",
  "Detailed structural design": "Részletes tartószerkezeti tervezés",
  "Structural design design documentation": "Tartószerkezeti tervdokumentáció",
  "Structural design plans": "Tartószerkezeti tervek",
  "Structural engineering design": "Tartószerkezeti tervezés",
  "Structural design": "Tartószerkezeti tervezés",
  "architectural and structural design": "építészeti és tartószerkezeti tervezés",
  "Architectural design": "Építészeti tervezés",
  Architecture: "Építészet",
  "Supporting structure permit plan": "Tartószerkezeti engedélyezési terv",
  "Support structure permit": "Tartószerkezeti engedélyezési terv",
  "Supporting structures": "Tartószerkezetek",
  "Supporting structure": "Tartószerkezet",
  "supporting structure": "tartószerkezet",
  "Support structure": "Tartószerkezet",
  Manufacture: "Gyártmánytervezés",
  manufacture: "gyártmánytervezés",
  "Production design": "Gyártmánytervezés",
  "production design": "gyártmánytervezés",
  "Workshop design": "Gyártmánytervezés",
  "workshop design": "gyártmánytervezés",
  "Site supervision": "Helyszíni művezetés",
  "Professional opinion": "Szakvélemény",
  "Feasibility Study": "Megvalósíthatósági tanulmány",
  "Detailed design": "Kiviteli tervezés",
  Detailed: "Kiviteli",
  Permit: "Engedélyezési terv",
  General: "Generál",
  "Designs for approval": "Jóváhagyási tervek",
  "Final designs": "Végleges tervek",
};

const WORK_TYPE_ZH: Record<string, string> = {
  "A Structural design of all steel structures, including workshop design":
    "全部钢结构的结构设计，包括加工图设计",
  "Architectural and structural design and production design":
    "建筑设计、结构设计及生产设计",
  "Architecture, Supporting structure permit plan, construction plan":
    "建筑、支承结构报批设计及施工图设计",
  "Complete general design in addition to architectural and structural design":
    "全专业总体设计，包括建筑及结构设计",
  "Complete general design, including architectural and structural design":
    "全专业总体设计，包括建筑及结构设计",
  "Complete general design, including architectural and structural engineering design":
    "全专业总体设计，包括建筑及结构工程设计",
  "Feasibility Study - General Design": "可行性研究 - 总体设计",
  "Full-scope design, Designs for approval, Tendering and Final designs":
    "全范围设计、审批设计、招标设计及最终设计",
  "Full-scope design, Planning permission, Detailed design":
    "全范围设计、报批设计及详细设计",
  "Full-scope planning, Planning Permission Documents, Implementation Documents":
    "全范围设计、报批文件及施工图文件",
  "General design of supporting structures, Detail design of reinforced concrete structures, Execution plans":
    "支承结构总体设计、钢筋混凝土结构详细设计及施工图设计",
  "General planning, Building permit plans, Construction plans":
    "总体设计、报批设计及施工图设计",
  "General planning, Building permit plans, Construction plans, Tender plans":
    "总体设计、报批设计、施工图设计及招标设计",
  "General, Architecture support structure, Licensing, design, manufacture":
    "总体设计、建筑支承结构、许可、设计及加工图设计",
  "General, Architecture, Structural design, Building permit, Detailed design":
    "总体设计、建筑、结构设计、报批设计及详细设计",
  "General, Architecture, Structural design, Building permit, Detailed design, Manufacture":
    "总体设计、建筑、结构设计、报批设计、详细设计及加工图设计",
  "General, Architecture, Support structure, Licensing, Detailed design, manufacture":
    "总体设计、建筑、支承结构、许可、详细设计及加工图设计",
  "Permit, tender & detailed design, site supervision":
    "报批设计、招标及详细设计、现场监督",
  "Planning Permission Documents, Tender Documents, Implementation Documents":
    "报批文件、招标文件及施工图文件",
  "Production design of steel structures": "钢结构生产设计",
  "Structural and architectural design plans": "结构及建筑设计图纸",
  "Support structure permit, tender and construction design documentation":
    "支承结构报批、招标及施工设计文件",
  "Planning Permission Documents": "报批文件",
  "Implementation Documents": "施工图文件",
  "Implementation plans": "施工图设计",
  "Execution plans": "施工图设计",
  "Construction plans": "施工图设计",
  "Building permit plans": "报批设计",
  "Building permit and design documentation": "报批及设计文件",
  "Building permit": "报批设计",
  "Planning permission": "报批设计",
  Permission: "许可",
  Licensing: "许可",
  "Tender Documents": "招标文件",
  "Tender plans": "招标设计",
  Tendering: "招标设计",
  Tender: "招标",
  "Complete general design": "全专业总体设计",
  "Full-scope planning": "全范围设计",
  "Full-scope design": "全范围设计",
  "General planning": "总体设计",
  "General design": "总体设计",
  "Detailed structural design": "详细结构设计",
  "Structural design design documentation": "结构设计文件",
  "Structural design plans": "结构设计图纸",
  "Structural engineering design": "结构工程设计",
  "Structural design": "结构设计",
  "architectural and structural design": "建筑及结构设计",
  "Architectural design": "建筑设计",
  Architecture: "建筑",
  "Supporting structure permit plan": "支承结构报批设计",
  "Support structure permit": "支承结构报批设计",
  "Supporting structures": "支承结构",
  "Supporting structure": "支承结构",
  "supporting structure": "支承结构",
  "Support structure": "支承结构",
  Manufacture: "加工图设计",
  manufacture: "加工图设计",
  "Production design": "生产设计",
  "production design": "生产设计",
  "Workshop design": "加工图设计",
  "workshop design": "加工图设计",
  "Site supervision": "现场监督",
  "Professional opinion": "专业意见",
  "Feasibility Study": "可行性研究",
  "Detailed design": "详细设计",
  Detailed: "详细",
  Permit: "报批设计",
  General: "总体",
  "Designs for approval": "审批设计",
  "Final designs": "最终设计",
};

const COUNTRY_HU: Record<string, string> = {
  Algeria: "Algéria",
  Cuba: "Kuba",
  Germany: "Németország",
  Hungary: "Magyarország",
  Pakistan: "Pakisztán",
  Poland: "Lengyelország",
};

const COUNTRY_ZH: Record<string, string> = {
  Algeria: "阿尔及利亚",
  Cuba: "古巴",
  Germany: "德国",
  Hungary: "匈牙利",
  Pakistan: "巴基斯坦",
  Poland: "波兰",
};
