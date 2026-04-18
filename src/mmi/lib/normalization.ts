import countries from "world-countries";

type RawCountry = {
  cca2: string;
  name: { common: string };
  region: string;
  latlng?: [number, number];
  translations?: Record<string, { common?: string; official?: string }>;
};

export type NormalizedCountry = {
  country: string;
  countryCode: string;
  continent: string;
  latitude: number;
  longitude: number;
};

const COUNTRY_ALIASES: Record<string, string> = {
  magyarorszag: "Hungary",
  magyarország: "Hungary",
  nemetorszag: "Germany",
  németország: "Germany",
  lengyelorszag: "Poland",
  lengyelország: "Poland",
  algéria: "Algeria",
  algeria: "Algeria",
  pakisztán: "Pakistan",
  pakistan: "Pakistan",
  kuba: "Cuba",
  cuba: "Cuba",
  magyar: "Hungary",
};

const CITY_COORDINATES: Record<string, [number, number]> = {
  budapest: [47.4979, 19.0402],
  pécs: [46.0727, 18.2323],
  pecs: [46.0727, 18.2323],
  debrecen: [47.5316, 21.6273],
  szombathely: [47.2307, 16.6218],
  harburg: [48.7867, 10.6893],
  bük: [47.3849, 16.7507],
  buk: [47.3849, 16.7507],
  veszprém: [47.1028, 17.9093],
  baja: [46.1829, 18.9536],
  kiskunfélegyháza: [46.7121, 19.8446],
  királyegyháza: [45.9994, 18.0871],
  kaposvár: [46.3594, 17.7968],
  gueltat: [34.2167, 2.3833],
  relizane: [35.7373, 0.5559],
  jamshoro: [25.4361, 68.2802],
  nuevitas: [21.5456, -77.2644],
  vác: [47.7838, 19.1349],
  pétfürdő: [47.1667, 18.1167],
  komló: [46.1911, 18.2649],
  kunszállás: [46.7591, 19.7485],
  "strzelce opolskie": [50.5107, 18.3006],
  srzelce: [50.5107, 18.3006],
  mohács: [45.9931, 18.6831],
  dunaföldvár: [46.8074, 18.9267],
  tatabánya: [47.5692, 18.4048],
  dunaújváros: [46.9619, 18.9355],
  siófok: [46.9041, 18.058],
  beremend: [45.7914, 18.4333],
};

const COUNTRY_INDEX = buildCountryIndex(countries as RawCountry[]);

export function cleanText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

export function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const cleaned = cleanText(value);
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(cleaned);
    }
  }

  return result;
}

export function parseYearLabel(value: string | null | undefined): {
  yearLabel: string | null;
  yearFrom: number | null;
  yearTo: number | null;
} {
  const yearLabel = cleanText(value);
  if (!yearLabel) {
    return { yearLabel: null, yearFrom: null, yearTo: null };
  }

  const matches = [...yearLabel.matchAll(/\b(19|20)\d{2}\b/g)].map((match) =>
    Number(match[0]),
  );

  return {
    yearLabel,
    yearFrom: matches[0] ?? null,
    yearTo: yearLabel.endsWith("-") ? null : matches[1] ?? matches[0] ?? null,
  };
}

export function normalizeCountryFromLocation(
  locationText: string | null | undefined,
): NormalizedCountry | null {
  const cleaned = cleanText(locationText);
  if (!cleaned) {
    return null;
  }

  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  const candidates = [...parts].reverse();

  for (const candidate of candidates) {
    const country = findCountry(candidate);
    if (country) {
      return country;
    }
  }

  return null;
}

export function parseLocationParts(locationText: string | null | undefined): {
  city: string | null;
  region: string | null;
  country: NormalizedCountry | null;
  coordinates: [number, number] | null;
} {
  const cleaned = cleanText(locationText);
  const country = normalizeCountryFromLocation(cleaned);
  if (!cleaned) {
    return { city: null, region: null, country, coordinates: null };
  }

  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts[0] ?? null;
  const region = parts.length > 2 ? parts.slice(1, -1).join(", ") : parts[1] ?? null;
  const cityCoordinates = city ? findCityCoordinates(city) : null;

  return {
    city,
    region: region && country?.country !== region ? region : null,
    country,
    coordinates: cityCoordinates,
  };
}

function findCountry(value: string): NormalizedCountry | null {
  const normalized = normalizeKey(value);
  const alias = COUNTRY_ALIASES[normalized];
  const key = alias ? normalizeKey(alias) : normalized;

  return COUNTRY_INDEX.get(key) ?? null;
}

function findCityCoordinates(city: string): [number, number] | null {
  const normalized = normalizeKey(city);
  const direct = CITY_COORDINATES[normalized];
  if (direct) {
    return direct;
  }

  const firstName = normalizeKey(city.split(/[/-]/)[0]);
  return CITY_COORDINATES[firstName] ?? null;
}

function buildCountryIndex(rawCountries: RawCountry[]): Map<string, NormalizedCountry> {
  const index = new Map<string, NormalizedCountry>();

  for (const country of rawCountries) {
    const [latitude, longitude] = country.latlng ?? [0, 0];
    const normalized: NormalizedCountry = {
      country: country.name.common,
      countryCode: country.cca2,
      continent: country.region,
      latitude,
      longitude,
    };

    index.set(normalizeKey(country.name.common), normalized);
    index.set(normalizeKey(country.cca2), normalized);

    for (const translation of Object.values(country.translations ?? {})) {
      if (translation.common) {
        index.set(normalizeKey(translation.common), normalized);
      }
      if (translation.official) {
        index.set(normalizeKey(translation.official), normalized);
      }
    }
  }

  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    const country = index.get(normalizeKey(canonical));
    if (country) {
      index.set(alias, country);
    }
  }

  return index;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
