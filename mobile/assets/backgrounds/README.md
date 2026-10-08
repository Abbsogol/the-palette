# Search background, 4K delivery

- Source: `../figma/search/7ff65.png`, original Figma-derived asset, 479 × 1024 pixels. Preserved unchanged.
- Output: `search-background-4k.png`, 1792 × 3840 pixels, opaque PNG, 5,923,804 bytes.
- SHA-256: `68ddc62a3f98c5ac081cfd7b7c0ecbdeed8e3c79352dcac8b9819340e886d64c`.
- Created 2026-09-28 using the built-in image-generation tool in edit mode. This is an AI-restored derivative, not a new Figma export or recovered original detail.
- The tool returned 857 × 1836 pixels despite the requested size. macOS `sips --resampleHeightWidth 3840 1792` normalized the delivery file to its requested 4K long edge. It is an upscaled delivery, not native 4K generation.
- Search and its filter sheet share this asset via `src/features/search/assets.ts`. Existing crop geometry and the fixed Search header remain unchanged. The source is deliberately a soft abstract gradient; increased pixel dimensions do not make it a sharply focused photograph.

## Exact edit prompt

Edit target: the attached existing LaQue Search background, currently 479 x 1024 pixels. Upscale and carefully restore it as a 4K portrait background, target 1792 x 3840 pixels (3840-pixel long edge, preserve the original tall aspect ratio). Keep the exact original composition, color placement, and original dark burgundy, muted wine, charcoal-black and rose pink palette. The original is an abstract atmospheric gradient with a broad pink glow slightly right of center, darker left/lower region, a small pink light near lower right, and subtle fine-grain texture. Retain those features at their same relative positions. Improve low-resolution smeary texture and compression: render very clean continuous gradients and refined, very fine uniform grain at the new resolution, gently clearer tonal separation without altering the overall softness or design. Do not invent subjects, objects, text, borders, logos, highlights, ornaments, or dramatic new shapes. No UI. This is a faithful high-resolution replacement for the existing background, not a redesign. Output a full-resolution image file.
