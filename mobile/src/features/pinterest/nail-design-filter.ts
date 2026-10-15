import {
  COLOR_TERMS,
  FILTER_OPTIONS,
  VIBE_TERMS,
  emptyFilters,
  type FilterGroup,
  type SearchFilters,
} from "../search/filters";

// Text-only rules. No network, image recognition, storage or paid SDK is used.
// The caller must obtain Pins through an approved Pinterest integration first.
export type PinterestPinText = {
  id: string;
  title?: string | null;
  description?: string | null;
  alt_text?: string | null;
  // Optional metadata supplied by an adapter, not a required Pinterest API field.
  tags?: readonly string[];
};
export type NailDesignAssessment = {
  eligible: boolean;
  reason: "nail-design" | "unrelated" | "insufficient-text" | "excluded-topic";
  categories: SearchFilters;
};
export type PinterestFilterOptions = {
  query?: string;
  filters?: Partial<SearchFilters>;
};
const groups = Object.keys(FILTER_OPTIONS) as FilterGroup[];

function words(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .slice(0, 4000)
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const aliases: Partial<Record<FilterGroup, Record<string, string[]>>> = {
  vibe: {
    // Generic "art" and "tip" would mislabel almost every nail-art Pin.
    "Abstract & Art": ["abstract", "ink", "aura", "neon"],
    "French Tip": ["french", "milk glass"],
  },
  length: { "Extra Long": ["extra long", "xl", "xxl"] },
  technique: {
    "Press-On": ["press on", "press ons", "presson", "pressons"],
    Ombre: ["ombre", "gradient"],
    "Cat Eye": ["cat eye", "cat eyes", "cateye"],
  },
};
const categoryRules = groups.flatMap((group) =>
  FILTER_OPTIONS[group].map((label) => ({
    group,
    label,
    terms: (aliases[group]?.[label] ??
      (group === "vibe"
        ? VIBE_TERMS[label]
        : group === "color"
          ? COLOR_TERMS[label]
          : [label])).map(words),
  })),
);

// Split known compound hashtags, without guessing arbitrary word boundaries.
const compounds = new Map<string, string>([
  ["nailart", "nail art"],
  ["naildesign", "nail design"],
  ["naildesigns", "nail designs"],
  ["nailinspo", "nail inspo"],
  ["nailinspiration", "nail inspiration"],
  ["nailsoftheday", "nails of the day"],
  ["frenchtips", "french tips"],
]);
for (const { terms } of categoryRules) {
  for (const term of terms) {
    if (term.includes(" ")) compounds.set(term.replaceAll(" ", ""), term);
    compounds.set(`${term.replaceAll(" ", "")}nails`, `${term} nails`);
  }
}

function text(value: unknown): string {
  return words(value)
    .split(" ")
    .map((word) => compounds.get(word) ?? word)
    .join(" ");
}
function contains(value: string, phrase: string): boolean {
  return (` ${value} `).includes(` ${phrase} `);
}
function positiveMention(value: string, phrase: string): boolean {
  return contains(value, phrase) &&
    !["no", "not", "without"].some((negation) => contains(value, `${negation} ${phrase}`));
}
function pinText(pin: PinterestPinText): string[] {
  const tags = Array.isArray(pin.tags) ? pin.tags.slice(0, 30) : [];
  return [pin.title, pin.description, pin.alt_text, ...tags]
    .map(text)
    .filter(Boolean);
}

const excludedTopics = [
  "nail gun", "nail guns", "roofing", "carpentry", "construction nails",
  "framing nails", "brad nails", "woodworking", "hammer and nails",
  "fungus", "fungal", "onychomycosis", "ingrown", "nail infection",
  "nail disease", "nail diseases", "nail melanoma", "nail psoriasis",
  "not nail art", "not nails",
];
const excludedListings = [
  "nail drill", "nail drills", "nail clipper", "nail clippers",
  "nail lamp", "uv lamp", "led lamp", "cuticle oil", "cuticle remover",
  "nail polish remover", "nail glue", "nail course", "nail courses",
  "nail technician course", "price list", "nail salon furniture",
  "nail salon logo", "nail polish bottle", "business card",
];
const designPhrases = [
  "nail art", "nail design", "nail designs", "nail inspo", "nail inspiration",
  "nails inspiration", "nail ideas", "nails of the day", "nail look",
  "nail looks", "manicure ideas", "manicure inspiration",
];
const nailWords = ["nail", "nails", "manicure", "manicures", "mani"];
const singularWords = new Map([
  ["nails", "nail"],
  ["designs", "design"],
  ["manicures", "manicure"],
  ["tips", "tip"],
]);

export function assessPinterestNailDesign(
  pin: PinterestPinText | null | undefined,
): NailDesignAssessment {
  const categories = emptyFilters();
  const reject = (reason: NailDesignAssessment["reason"]) => ({
    eligible: false, reason, categories: emptyFilters(),
  });
  if (!pin) return reject("insufficient-text");
  const fields = pinText(pin);
  if (!fields.length) return reject("insufficient-text");
  if (
    fields.some((field) => excludedTopics.some((term) => contains(field, term))) ||
    excludedListings.some((term) => contains(text(pin.title), term))
  ) return reject("excluded-topic");

  for (const { group, label, terms } of categoryRules) {
    if (fields.some((field) => terms.some((term) => positiveMention(field, term))))
      categories[group].push(label);
  }
  // "Extra Long" must not also satisfy the separate "Long" length filter.
  if (categories.length.includes("Extra Long"))
    categories.length = categories.length.filter((length) => length !== "Long");

  const explicitDesign = fields.some((field) =>
    designPhrases.some((phrase) => contains(field, phrase)),
  );
  const hasNailContext = fields.some((field) =>
    nailWords.some((word) => contains(field, word)),
  );
  const hasCategory = groups.some((group) => categories[group].length > 0);
  if (!explicitDesign && !(hasNailContext && hasCategory))
    return reject("unrelated");

  return { eligible: true, reason: "nail-design", categories };
}

function matchesFilters(categories: SearchFilters, filters: Partial<SearchFilters>) {
  return Object.entries(filters).every(([key, selected]) => {
    if (!groups.includes(key as FilterGroup) || !Array.isArray(selected)) return false;
    const group = key as FilterGroup;
    if (!selected.every((label) => (FILTER_OPTIONS[group] as readonly string[]).includes(label)))
      return false;
    return !selected.length || selected.some((label) => categories[group].includes(label));
  });
}

/** Reuse for Home (no query) and Search. Never fetches Pins or changes their metadata. */
export function filterPinterestDesigns<T extends PinterestPinText>(
  pins: readonly T[],
  { query = "", filters = {} }: PinterestFilterOptions = {},
): { pin: T; categories: SearchFilters }[] {
  const tokens = text(query).split(" ").filter(Boolean);
  const seen = new Set<string>();
  const result: { pin: T; categories: SearchFilters }[] = [];
  for (const pin of pins) {
    if (!pin || typeof pin.id !== "string" || !pin.id.trim() || seen.has(pin.id)) continue;
    const assessment = assessPinterestNailDesign(pin);
    if (!assessment.eligible || !matchesFilters(assessment.categories, filters)) continue;
    const fields = [
      ...pinText(pin),
      ...groups.flatMap((group) => assessment.categories[group].map(text)),
    ];
    if (!tokens.every((token) => {
      const singular = singularWords.get(token);
      const terms = singular ? [singular, token] : [token, `${token}s`];
      return terms.some((term) => fields.some((field) => positiveMention(field, term)));
    })) continue;
    seen.add(pin.id);
    result.push({ pin, categories: assessment.categories });
  }
  return result;
}
