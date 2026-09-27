// Nail Lab board-prompt builder + helpers. Source of truth for the prompt sent
// to gpt-image-1 by app/api/generate-nail-design/route.js. The Nail Lab screen
// (app/nail-lab/page.js) is intentionally NOT imported here — the preset swatch
// labels below are mirrored from it so the server can name colours in the prompt
// without depending on the screen. Keep the two lists in sync if the screen's
// PRESET_COLORS ever changes.

// ── Shape blocks ──────────────────────────────────────────────────────────
// One fixed paragraph per shape, word-for-word. Keyed by lowercased shape name.
export const SHAPE_BLOCKS = {
  stiletto: "Wearable salon stiletto, approximately 2.1 times as long as its maximum width. The widest area is near the upper shoulder. Both sidewalls taper continuously and symmetrically toward one centered acute apex. Sidewalls are straight to subtly convex—never concave. The final point has microscopic safety rounding and believable acrylic thickness. It is elegant and physically manufacturable, not a claw, fang, dagger, or needle.",
  oval: "Wearable salon oval nail shown straight-on in front elevation, approximately 1.5 times as long as its maximum width. The sidewalls remain nearly parallel through most of the nail and begin rounding only within the final lower third. The free edge forms one broad, smooth semicircular curve spanning almost the entire nail width. There is no apex, central point, pinching, or early taper. The silhouette is elongated and softly rounded—not almond-shaped. Cuticle end at the top and rounded free edge at the bottom. Perfect bilateral symmetry and believable professional press-on nail thickness.",
  almond: "Wearable salon almond nail shown straight-on in front elevation, approximately 1.8 times as long as its maximum width. The widest area is near the upper shoulder. Both sidewalls begin narrowing around 35–40% of the nail length and continue in smooth, symmetrical convex curves toward a distinctly narrow but softly rounded central apex. The apex must be visibly narrower than an oval nail but must not become sharp. No broad semicircular tip, flat edge, concave sidewalls, needle point, or stiletto appearance. Cuticle end at the top and rounded apex at the bottom. Perfect bilateral symmetry and believable professional press-on nail thickness.",
  square: "Square nails with straight parallel sidewalls and a flat horizontal tip. Sharp clean corners, boxy silhouette, even width from base to tip, no tapering, no rounded tip. Nail shape must be exactly: square. Do not generate any other nail shape.",
  squoval: "Squoval nails with mostly straight square sidewalls and a flat tip, but with softly rounded corners. Square-oval hybrid shape, not fully round, not sharp, not tapered. Nail shape must be exactly: squoval. Do not generate any other nail shape.",
  coffin: "Ballerina coffin nails with tapered sidewalls and a flat squared-off tip. Long slim coffin silhouette, narrow at the tip but completely flat across the end, no point, no rounded tip, not stiletto. Nail shape must be exactly: coffin. Do not generate any other nail shape.",
}

// ── Background blocks ─────────────────────────────────────────────────────
export const BACKGROUND_OBSIDIAN = `Use one uninterrupted clean neutral-obsidian background across the entire board.
Base color: #111114. Add an extremely subtle, seamless radial tonal lift behind the nail rows, reaching no lighter than #19191D at the center and gradually deepening to #0B0B0D near the outer edges. The transition must be smooth and nearly imperceptible, with no visible halo.
The background must remain neutral black with no brown, beige, green, blue, or dirty gray undertone. No texture, mottling, concrete effect, smoke, fabric, grain, dust, scratches, cloudy patches, panels, boxes, frames, or white areas.
Use controlled photographic rim lighting to separate very dark nails from the background naturally. Do not add a drawn outline around the nails.
Main text: #F5EDE0. Secondary text (labels, divider lines): #9B9693.`

export const BACKGROUND_IVORY = `Use one uninterrupted refined warm-ivory background across the entire board.
Base color: #F5EDE0. Add an extremely subtle seamless radial lift behind the nail rows, reaching no lighter than #FBF7F0 in the central nail field and gently deepening to #E8DED1 at the far outer edges. The transition must be smooth and nearly imperceptible, with no visible halo or gradient banding.
The background must feel clean, creamy, soft, luxurious, and editorial. It must not appear yellow, peach, gray, muddy, aged, or paper-like. No pure white areas.
No texture, paper fibers, grain, mottling, marble, concrete, smoke, fabric, dust, scratches, cloudy patches, panels, boxes, frames, or inset areas.
Nails float naturally above the background with restrained soft neutral-taupe drop shadows and realistic studio separation. Shadows must be subtle, clean, and consistent—never heavy, dirty, blurry, or halo-like. Do not add drawn outlines around the nails.
Keep the background and lighting neutral so the nail colors remain accurate and unaffected by warm color contamination.
Main text: #242226. Secondary text (labels, divider lines): #575157.`

// ── Background choice ─────────────────────────────────────────────────────
// Contrast rule: DARK nails go on IVORY, LIGHT nails go on OBSIDIAN.
// When colours are picked we average their luminance; when none are picked we
// fall back to the vibe. Tune the threshold here (0..1, perceived luminance).
export const DARK_NAIL_LUMINANCE_THRESHOLD = 0.5

// Vibe → background when no colours were picked.
export const VIBE_BACKGROUND = {
  Moody: 'ivory', Dark: 'ivory', Edgy: 'ivory', Y2K: 'ivory',
  Minimal: 'obsidian', 'Clean Girl': 'obsidian', Pastel: 'obsidian',
  Bridal: 'obsidian', Coastal: 'obsidian', Floral: 'obsidian',
  Glam: 'obsidian', Abstract: 'obsidian',
}

// Vibe → design-name hint (kept from the previous prompt; subtitle dropped).
export const VIBE_NAME_HINTS = {
  'Minimal': 'clean, understated (e.g. "Bare Silk", "Still Water", "Clean Slate")',
  'Moody': 'dark and atmospheric (e.g. "Velvet Noir", "Storm Glass", "Dusk Hour")',
  'Dark': 'bold and dramatic (e.g. "Midnight Lacquer", "Black Onyx", "Shadow Run")',
  'Coastal': 'fresh and watery (e.g. "Salt & Stone", "Sea Glass", "Pearl Tide")',
  'Glam': 'luxurious and shiny (e.g. "Gold Rush", "Chrome Queen", "Mirror Gloss")',
  'Y2K': 'playful and nostalgic (e.g. "Cherry Pop", "Cyber Pink", "2000 Shimmer")',
  'Bridal': 'soft and romantic (e.g. "Ivory Veil", "Blush Bloom", "White Petal")',
  'Abstract': 'artistic and unexpected (e.g. "Ink Drop", "Paint Theory", "Colour Study")',
  'Floral': 'delicate and botanical (e.g. "Rose Sketch", "Petal Press", "Garden Edit")',
  'Pastel': 'soft and dreamy (e.g. "Cotton Cloud", "Lilac Air", "Pale Blush")',
  'Edgy': 'sharp and striking (e.g. "Razor Edge", "Chrome Spike", "Ink Black")',
  'Clean Girl': 'polished and natural (e.g. "Your Nails But Better", "Glazed Skin", "Soft Sheer")',
}

// ── Colour naming ─────────────────────────────────────────────────────────
// Preset swatch labels mirrored from app/nail-lab/page.js PRESET_COLORS. Keys
// are lowercased hex. A picked colour that matches a preset uses its label;
// anything else (custom hex) gets a name derived from HSL.
const PRESET_LABELS = {
  '#f5ede3': 'Bone', '#f0dcc8': 'Almond', '#e8c4a0': 'Peach Nude', '#c9a882': 'Caramel', '#a67c5b': 'Tawny', '#7b5240': 'Mocha',
  '#ffd6e0': 'Baby Pink', '#f5a8c0': 'Blush', '#f07098': 'Rose', '#e83875': 'Hot Pink', '#c8006a': 'Fuchsia',
  '#e84040': 'Red', '#c02020': 'Cherry', '#7a0020': 'Burgundy',
  '#d8c8f0': 'Lavender', '#b094d8': 'Lilac', '#7d4fbf': 'Violet', '#4b0082': 'Deep Grape',
  '#c8d8f0': 'Ice Blue', '#6890d8': 'Periwinkle', '#1450a8': 'Cobalt', '#0a2050': 'Navy',
  '#b0c8a8': 'Sage', '#70c890': 'Mint', '#2d7040': 'Forest', '#6b7040': 'Olive',
  '#d4af37': 'Gold', '#c0c0c0': 'Silver', '#c48b8b': 'Rose Gold',
  '#2a2828': 'Charcoal', '#141414': 'Black', '#ffffff': 'White',
}

function normHex(hex) {
  let h = String(hex || '').trim().toLowerCase()
  if (!h.startsWith('#')) h = '#' + h
  if (/^#[0-9a-f]{3}$/.test(h)) h = '#' + h.slice(1).split('').map(c => c + c).join('')
  return h
}

function hexToRgb(hex) {
  const h = normHex(hex)
  if (!/^#[0-9a-f]{6}$/.test(h)) return null
  return { r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) }
}

// Perceived luminance, 0..1.
export function luminance(hex) {
  const c = hexToRgb(hex)
  if (!c) return 0.5
  return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return { h, s, l }
}

// Human-ish colour name for a custom hex (no preset match). HSL → base hue name
// plus a lightness/saturation modifier. Not a perfect namer, but produces stable,
// plausible descriptors (e.g. "#acb0fc" → "soft periwinkle").
function hueName(h) {
  if (h < 15 || h >= 345) return 'red'
  if (h < 40) return 'orange'
  if (h < 65) return 'yellow'
  if (h < 90) return 'lime'
  if (h < 150) return 'green'
  if (h < 175) return 'teal'
  if (h < 200) return 'cyan'
  if (h < 225) return 'sky blue'
  if (h < 250) return 'periwinkle'
  if (h < 270) return 'indigo'
  if (h < 290) return 'violet'
  if (h < 320) return 'plum'
  return 'magenta'
}

export function colorName(hex) {
  const h = normHex(hex)
  if (PRESET_LABELS[h]) return PRESET_LABELS[h]
  const rgb = hexToRgb(h)
  if (!rgb) return h // give back the raw value rather than invent one
  const { h: hue, s, l } = rgbToHsl(rgb)
  // Near-greyscale: name by lightness only.
  if (s < 0.12) {
    if (l > 0.92) return 'white'
    if (l > 0.72) return 'light grey'
    if (l > 0.4) return 'grey'
    if (l > 0.15) return 'charcoal'
    return 'near-black'
  }
  const base = hueName(hue)
  let mod = ''
  if (l < 0.18) mod = 'deep'
  else if (l < 0.34) mod = 'dark'
  else if (l > 0.82) mod = 'pale'
  else if (l > 0.68) mod = 'soft'
  else if (s < 0.35) mod = 'muted'
  return mod ? `${mod} ${base}` : base
}

// ── Choose background ─────────────────────────────────────────────────────
export function chooseBackground(colors, vibe) {
  const list = Array.isArray(colors) ? colors.filter(Boolean) : []
  if (list.length) {
    const avg = list.reduce((sum, hx) => sum + luminance(hx), 0) / list.length
    const dark = avg < DARK_NAIL_LUMINANCE_THRESHOLD
    const choice = dark ? 'ivory' : 'obsidian'
    return {
      choice,
      block: dark ? BACKGROUND_IVORY : BACKGROUND_OBSIDIAN,
      reason: `avg nail luminance ${avg.toFixed(3)} ${dark ? '<' : '>='} ${DARK_NAIL_LUMINANCE_THRESHOLD} → ${dark ? 'dark nails → ivory' : 'light nails → obsidian'}`,
    }
  }
  const primary = Array.isArray(vibe) ? vibe[0] : vibe
  const choice = VIBE_BACKGROUND[primary] || 'obsidian'
  return {
    choice,
    block: choice === 'ivory' ? BACKGROUND_IVORY : BACKGROUND_OBSIDIAN,
    reason: `no colours picked; vibe "${primary}" → ${choice}`,
  }
}

// ── Shape block ───────────────────────────────────────────────────────────
export function shapeBlock(shape, length) {
  const key = String(shape || '').trim().toLowerCase()
  const block = SHAPE_BLOCKS[key] || `Wearable salon ${shape} nail, shown straight-on in front elevation with perfect bilateral symmetry and believable professional press-on nail thickness.`
  return `${block}\nNail length: ${length}.`
}

// ── Design description (the only free part) ───────────────────────────────
export function buildDesignDescription({ vibeList, colors, occasion, customText }) {
  const lines = []
  if (vibeList) lines.push(`Design: ${vibeList} aesthetic.`)
  const named = (Array.isArray(colors) ? colors.filter(Boolean) : [])
    .map(hx => `${colorName(hx)} (${normHex(hx)})`)
    .join(', ')
  if (named) lines.push(`Colours: ${named}`)
  const occ = Array.isArray(occasion) ? occasion.filter(Boolean).join(', ') : (occasion || '')
  if (occ) lines.push(`Occasion: ${occ}`)
  if (customText) lines.push(`Additional details: ${customText}`)
  return lines.join('\n')
}

// ── Full prompt ───────────────────────────────────────────────────────────
export function buildNailLabPrompt({ shape, length, vibe, colors, occasion, customText }) {
  const vibeList = Array.isArray(vibe) ? vibe.join(' + ') : vibe
  const bg = chooseBackground(colors, vibe)
  const shp = shapeBlock(shape, length)
  const desc = buildDesignDescription({ vibeList, colors, occasion, customText })
  const primaryVibe = Array.isArray(vibe) ? vibe[0] : vibe
  const nameHint = VIBE_NAME_HINTS[primaryVibe] || `reflecting the ${primaryVibe} aesthetic`

  const prompt = `A professional nail design reference board. ${bg.block}

Top center: title text "✦ [DESIGN NAME] ✦" in elegant serif font coloured to match the nail palette. No subtitle. No secondary text below the title.

Center: two rows of 5 photorealistic nails spanning the full width of the board. Label "SET 1" in small text at the left of the first row. A thin single decorative line with a small ✦ in the centre divides the two rows. Label "SET 2" in small text at the left of the second row. Nails float on the background with soft drop shadows. No panels, no boxes, no backgrounds behind the nails. No hands, no fingers, no skin — nails only.

Exactly 10 nails total — 5 in SET 1, 5 in SET 2. Do not add a third row, fourth row, or any additional sets. Stop at 10.

No detail shots. No right side panel. No monogram. No logo. No decorative elements other than the ✦ divider between rows.

Photorealistic, editorial luxury nail lookbook, 4K, clean professional layout.

Flat, even studio lighting across all nails. No specular highlight, no central gloss reflection, no dome-like sheen. The nail surface should appear smooth and matte-satin — lit from above with diffused light, like a professional product photograph, not a 3D render. The nail should read as a flat painted surface, not a rounded object.

${shp}

${desc}

DESIGN NAME: Choose a name that is ${nameHint}.`

  return { prompt, background: bg.choice, backgroundReason: bg.reason }
}
