export type LabSettings = {
  vibe: string[];
  shape: string;
  length: string;
  colors: string[];
  occasion: string[];
  customText: string;
};
export const defaultLabSettings = (): LabSettings => ({
  vibe: ["Bridal"],
  shape: "Almond",
  length: "Medium",
  colors: [],
  occasion: [],
  customText: "",
});
export const labOptions = {
  vibe: [
    "Minimal",
    "Moody",
    "Dark",
    "Coastal",
    "Glam",
    "Y2K",
    "Bridal",
    "Abstract",
    "Floral",
    "Pastel",
    "Edgy",
    "Clean Girl",
  ],
  shape: ["Almond", "Stiletto", "Coffin", "Square", "Oval", "Squoval"],
  length: ["Short", "Medium", "Long", "Extra Long"],
  occasion: [
    "Everyday",
    "Date Night",
    "Wedding",
    "Work",
    "Festival",
    "Birthday",
    "Holiday",
    "Party",
  ],
};
export function toggleChoice(
  current: string[],
  value: string,
  maximum: number,
) {
  if (current.includes(value)) return current.filter((item) => item !== value);
  return current.length < maximum ? [...current, value] : current;
}
export function normalizedHex(value: string) {
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toUpperCase()}`;
  if (/^[0-9a-f]{3}$/i.test(hex))
    return `#${hex
      .split("")
      .map((c) => c + c)
      .join("")
      .toUpperCase()}`;
  return null;
}
