export function validateDesignDetails(body) {
  const fields = {};
  for (const [key, max] of [
    ["description", 2000],
    ["shape", 40],
    ["length", 40],
    ["category", 80],
    ["technique", 120],
    ["occasion", 80],
  ]) {
    if (typeof body[key] !== "string" || body[key].length > max)
      throw new Error(`Enter valid ${key}.`);
    fields[key] = body[key].trim();
  }
  if (
    body.isPublished &&
    (!fields.description ||
      !fields.shape ||
      !fields.length ||
      !fields.technique)
  )
    throw new Error(
      "Add a description, shape, length and technique before publishing.",
    );
  if (
    !Array.isArray(body.colours) ||
    body.colours.length > 12 ||
    !Array.isArray(body.tags) ||
    body.tags.length > 20 ||
    !Array.isArray(body.images) ||
    !body.images.length ||
    body.images.length > 8
  )
    throw new Error("Choose 1–8 photos, up to 12 colours and 20 tags.");
  const colours = body.colours.map((c) => {
    const out = {};
    for (const key of ["colour_name", "hex_code", "brand_name", "brand_code"]) {
      if (typeof c?.[key] !== "string" || c[key].length > 100)
        throw new Error("Check your colour details.");
      out[key] = c[key].trim();
    }
    if (
      !out.colour_name ||
      (out.hex_code && !/^#[a-f\d]{6}$/i.test(out.hex_code))
    )
      throw new Error(
        "Enter a colour name and a valid six-digit hex code, or leave unknown codes blank.",
      );
    return out;
  });
  const tags = [
    ...new Set(
      body.tags.map((t) => {
        if (typeof t !== "string" || !/^#?[a-z\d_]{1,40}$/i.test(t.trim()))
          throw new Error("Tags can contain letters, numbers and underscores.");
        return t.trim().replace(/^#/, "").toLowerCase();
      }),
    ),
  ];
  return { fields, colours, tags };
}
