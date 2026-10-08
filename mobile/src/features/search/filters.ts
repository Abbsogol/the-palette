export const FILTER_OPTIONS = {
  vibe: [
    "Dark & Moody",
    "Minimal & Clean",
    "Floral",
    "Coastal & Summer",
    "Y2k & Retro",
    "Pastel & Soft",
    "Bridal & Wedding",
    "Korean Style",
    "Celestial",
    "Abstract & Art",
    "Autumn & Winter",
    "Boho & Earthy",
    "French Tip",
    "Gothic Soft",
    "Academia",
  ],
  color: [
    "Black",
    "White",
    "Pink",
    "Nude",
    "Mauve",
    "Berry",
    "Red",
    "Purple",
    "Lilac",
    "Blue",
    "Teal",
    "Green",
    "Sage",
    "Brown",
    "Caramel",
    "Gold",
    "Chrome",
    "Yellow",
    "Glitter",
    "Multi",
  ],
  shape: [
    "Stiletto",
    "Almond",
    "Square",
    "Coffin",
    "Oval",
    "Squoval",
    "Round",
    "Flare",
    "Ballerina",
  ],
  length: ["Short", "Medium", "Long", "Extra Long"],
  occasion: [
    "Everyday",
    "Night Out",
    "Editorial",
    "Statement",
    "Wedding",
    "Bridal",
    "Date Night",
    "Festival",
    "Holiday",
    "Vacation",
    "New Year's",
    "Christmas",
    "Halloween",
    "Valentine's",
    "Summer",
    "Autumn",
    "Winter",
    "Spring",
  ],
  technique: [
    "Gel",
    "Acrylic",
    "Dip Powder",
    "Polygel",
    "Hard Gel",
    "BIAB",
    "Nail Polish",
    "Press-On",
    "Airbrush",
    "Cat Eye",
    "3D Gel",
    "Nail Art",
    "Stamping",
    "Ombre",
    "Glitter",
    "Foil",
    "Chrome Powder",
  ],
} as const;
export type FilterGroup = keyof typeof FILTER_OPTIONS;
export type SearchFilters = Record<FilterGroup, string[]>;
export type SearchMode = "Designs" | "Artists";
export type SearchSort = "Newest" | "Most saved";
export const FILTER_LABELS: Record<FilterGroup, string> = {
  vibe: "Vibe & Style",
  color: "Color",
  shape: "Shape",
  length: "Length",
  occasion: "Occasion",
  technique: "Technique",
};
export const emptyFilters = (): SearchFilters => ({
  vibe: [],
  color: [],
  shape: [],
  length: [],
  occasion: [],
  technique: [],
});
export function toggleFilter(
  filters: SearchFilters,
  group: FilterGroup,
  value: string,
): SearchFilters {
  if (!(FILTER_OPTIONS[group] as readonly string[]).includes(value))
    return filters;
  return {
    ...filters,
    [group]: filters[group].includes(value)
      ? filters[group].filter((item) => item !== value)
      : [...filters[group], value],
  };
}
export const filterCount = (filters: SearchFilters) =>
  Object.values(filters).reduce((n, values) => n + values.length, 0);
// Same category vocabulary as web Search, kept separate from user-entered text.
export const VIBE_TERMS: Record<string, string[]> = {
  "Dark & Moody": ["dark", "gothic", "noir", "academia", "vampire"],
  "Minimal & Clean": ["minimal", "clean", "nude", "sheer", "glass"],
  Floral: ["floral", "flower", "blossom", "garden", "petal"],
  "Coastal & Summer": ["coastal", "summer", "sea", "ocean", "beach", "mermaid"],
  "Y2k & Retro": ["y2k", "retro", "nostalgia", "polaroid", "kodak", "film"],
  "Pastel & Soft": ["pastel", "cute", "baby", "soft", "cotton"],
  "Bridal & Wedding": ["bridal", "wedding", "bride", "ivory"],
  "Korean Style": ["korean"],
  Celestial: ["celestial", "galaxy", "moon", "star", "aurora"],
  "Abstract & Art": ["abstract", "art", "ink", "aura", "neon"],
  "Autumn & Winter": [
    "autumn",
    "winter",
    "fall",
    "warm nostalgia",
    "boho",
    "earthy",
  ],
  "Boho & Earthy": ["boho", "earthy", "terracotta", "desert", "sage"],
  "French Tip": ["french", "tip", "milk glass"],
  "Gothic Soft": [
    "gothic soft",
    "ghost",
    "soft ruin",
    "velvet rot",
    "moon ritual",
  ],
  Academia: ["academia", "dead poets", "leather", "ink bleed"],
};
export const COLOR_TERMS: Record<string, string[]> = {
  Black: ["black", "noir", "ebony", "onyx", "obsidian"],
  White: ["white", "ivory", "cream", "milk", "vanilla", "pearl"],
  Pink: ["pink", "rose", "blush", "petal", "peach", "coral"],
  Nude: ["nude", "sheer", "champagne"],
  Mauve: ["mauve", "dusty rose"],
  Berry: ["berry", "burgundy", "wine", "cranberry"],
  Red: ["red", "crimson", "cherry", "blood"],
  Purple: ["purple", "violet", "plum", "grape", "amethyst"],
  Lilac: ["lilac", "lavender"],
  Blue: ["blue", "navy", "cobalt", "sapphire"],
  Teal: ["teal", "aqua", "cyan"],
  Green: ["green", "mint", "olive", "moss", "forest", "emerald", "matcha"],
  Sage: ["sage"],
  Brown: ["brown", "chocolate", "espresso", "coffee", "terracotta", "sienna"],
  Caramel: ["caramel", "tan"],
  Gold: ["gold", "bronze", "copper"],
  Chrome: ["chrome", "silver", "metallic", "mirror"],
  Yellow: ["yellow", "lemon", "mustard"],
  Glitter: ["glitter", "sparkle"],
  Multi: ["multi", "rainbow", "iridescent", "holographic"],
};
export function selectedTerms(group: FilterGroup, values: string[]) {
  return [
    ...new Set(
      values
        .filter((v) => (FILTER_OPTIONS[group] as readonly string[]).includes(v))
        .flatMap((v) =>
          group === "vibe"
            ? VIBE_TERMS[v]
            : group === "color"
              ? COLOR_TERMS[v]
              : [v.toLowerCase()],
        ),
    ),
  ];
}
