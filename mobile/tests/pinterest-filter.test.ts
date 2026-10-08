import {
  assessPinterestNailDesign,
  filterPinterestDesigns,
  type PinterestPinText,
} from "../src/features/pinterest/nail-design-filter";
import { emptyFilters, type SearchFilters } from "../src/features/search/filters";

const pin = (title: string, extra: Partial<PinterestPinText> = {}): PinterestPinText => ({
  id: "123456789012345678",
  title,
  ...extra,
});

test.each([
  "Pink almond nails",
  "Short French manicure",
  "Wedding nail art",
  "Extra-long burgundy acrylic nails",
  "Gel manicure ideas",
  "#NailArt #PinkNails #AlmondNails",
  "#naildesigns #frenchtips #shortnails",
  "Chromé nail design",
  "PRESS-ON nail art",
])("includes text-supported nail inspiration: %s", (title) => {
  expect(assessPinterestNailDesign(pin(title)).eligible).toBe(true);
});

test.each([
  "Pink almond cake",
  "Snail art",
  "Thumbnail designs",
  "Red carpet fashion",
  "Square chrome table",
  "Nail gun with pink case",
  "Construction nails for woodworking",
  "Nail fungus treatment",
  "Nail psoriasis pictures",
  "Nail drill for acrylic nail art",
  "Nail clippers for short nails",
  "Nail salon logo in pink",
  "Black nail polish bottle",
  "Nail technician course: nail art",
  "Nail salon price list",
  "Not nail art: acrylic canvas painting",
])("excludes unrelated content and non-design listings: %s", (title) => {
  expect(assessPinterestNailDesign(pin(title)).eligible).toBe(false);
});

test("missing text remains unclassified, even when the user searches for nails", () => {
  expect(assessPinterestNailDesign(null).reason).toBe("insufficient-text");
  expect(assessPinterestNailDesign(pin("")).reason).toBe("insufficient-text");
  expect(filterPinterestDesigns([pin("")], { query: "nails" })).toEqual([]);
  expect(filterPinterestDesigns([pin("Pink shoes")], { query: "nail art" })).toEqual([]);
});

test("reads actual description, alt text and optional tags without using links as keywords", () => {
  expect(assessPinterestNailDesign(pin("Look", { description: "Pink nail art" })).eligible).toBe(true);
  expect(assessPinterestNailDesign(pin("Look", { alt_text: "Short almond manicure" })).eligible).toBe(true);
  expect(assessPinterestNailDesign(pin("Look", { tags: ["#nailart", "#pinknails"] })).categories.color).toEqual(["Pink"]);
  expect(assessPinterestNailDesign(pin("https://example.test/pink-nails" )).eligible).toBe(false);
});

test("assigns LaQue filters from text, without tagging all nail art as abstract or French", () => {
  const assessment = assessPinterestNailDesign(pin("Short pink almond gel nail art for a wedding"));
  expect(assessment.categories).toEqual({
    vibe: ["Bridal & Wedding"],
    color: ["Pink"],
    shape: ["Almond"],
    length: ["Short"],
    occasion: ["Wedding"],
    technique: ["Gel", "Nail Art"],
  });
});

test("normalizes hyphens, compound hashtags, accents and overlapping lengths", () => {
  const assessment = assessPinterestNailDesign(pin("Extra-long #PressOnNails #frenchtips with ombré"));
  expect(assessment.categories.length).toEqual(["Extra Long"]);
  expect(assessment.categories.technique).toEqual(["Press-On", "Ombre"]);
  expect(assessment.categories.vibe).toContain("French Tip");
  expect(filterPinterestDesigns([pin("XL acrylic nails")], { filters: { length: ["Long"] } })).toEqual([]);
});

test("does not infer red from unrelated substrings or colors explicitly ruled out", () => {
  const assessment = assessPinterestNailDesign(pin("Inspired pink nail art without black"));
  expect(assessment.categories.color).toEqual(["Pink"]);
  expect(filterPinterestDesigns([pin("Pink nail art without black")], { query: "black" })).toEqual([]);
});

test("OR within a filter group, AND between groups, and unknown choices fail closed", () => {
  const records = [
    pin("Short pink almond nails", { id: "1" }),
    pin("Short blue square nails", { id: "2" }),
    pin("Long pink almond nails", { id: "3" }),
    pin("Short green oval nails", { id: "4" }),
  ];
  expect(filterPinterestDesigns(records, {
    filters: { color: ["Pink", "Blue"], length: ["Short"] },
  }).map(({ pin: result }) => result.id)).toEqual(["1", "2"]);
  expect(filterPinterestDesigns(records, { filters: { shape: ["Made up"] } })).toEqual([]);
  expect(filterPinterestDesigns(records, {
    filters: { unknown: ["Pink"] } as unknown as Partial<SearchFilters>,
  })).toEqual([]);
});

test("Home works without a query; Search narrows the same accepted records", () => {
  const records = [
    pin("Pink nail art", { id: "1" }),
    pin("Blue short manicure", { id: "2" }),
    pin("Pink sneakers", { id: "3" }),
  ];
  expect(filterPinterestDesigns(records).map(({ pin: result }) => result.id)).toEqual(["1", "2"]);
  expect(filterPinterestDesigns(records, { query: "pink nails" }).map(({ pin: result }) => result.id)).toEqual(["1"]);
  expect(filterPinterestDesigns(records, { query: "blue short" }).map(({ pin: result }) => result.id)).toEqual(["2"]);
  expect(filterPinterestDesigns(records, { query: "red" })).toEqual([]);
});

test("user input is literal text, not a regular expression", () => {
  expect(filterPinterestDesigns([pin("Pink nail art")], { query: "(blue|green)+" })).toEqual([]);
});

test("preserves source metadata/order, deduplicates IDs, and never mutates the input", () => {
  const first = Object.freeze({ ...pin("Pink nails"), link: "https://creator.test", attribution: "Creator name" });
  const records = Object.freeze([first, first, pin("Blue nails", { id: "2" })]);
  const filters = Object.freeze(emptyFilters());
  const result = filterPinterestDesigns(records, { filters });
  expect(result.map(({ pin: entry }) => entry.id)).toEqual([first.id, "2"]);
  expect(result[0].pin).toBe(first);
  expect(result[0].pin).toMatchObject({ link: "https://creator.test", attribution: "Creator name" });
  expect(records).toHaveLength(3);
  expect(filters).toEqual(emptyFilters());
});

test("malformed external text and missing IDs cannot cause a crash or a rendered result", () => {
  const malformed = { id: "", title: 42, description: {}, tags: [null, false] } as unknown as PinterestPinText;
  expect(assessPinterestNailDesign(malformed).reason).toBe("insufficient-text");
  expect(filterPinterestDesigns([pin("Pink nails", { id: "" }), malformed])).toEqual([]);
});

test("classification performs no network requests", () => {
  const network = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network must not be used"));
  try {
    expect(filterPinterestDesigns([pin("Pink almond nails")])).toHaveLength(1);
    expect(network).not.toHaveBeenCalled();
  } finally {
    network.mockRestore();
  }
});
