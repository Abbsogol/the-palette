# Home main assets

Source: [LaQue / Home main, 345:3621](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3621).
Retrieved 2026-09-28 through the authenticated Figma connector.

`manifest.json` records all 32 local assets and their SHA-256 digests. No temporary download URL is retained in application code. SVG geometry is unchanged.

- `hero.png`: rendered image-only layer 345:3623, including its original crop, rotation and image adjustments. This is not a screenshot of the screen or of an interactive component.
- `02531.png`: decorative page background at x=-145, y=370, 908×1955 in the 393-pixel reference.
- `91e79.png`: community photograph, displayed in the original crop.
- `eabb1.png`, `60600.png`: community tile photographs.
- `069e4.png`, `11452.png`, `a957e.png`: decorative avatars; their individual heart SVGs remain separate layers.
- Navigation SVG roots: Home/Search/Lab/Profile 16×16 inside 20×20 slots; Messages/Saved 20×20. Header bell 20×20; header messages 18×18; search glyph 16×16; reaction/save glyphs 14×14.
- Remaining photographs are Figma sample catalog images used only by the development preview in `src/preview/home-main.tsx`. Live discovery retains database image URLs and records.

Anola Regular is bundled from the owner's supplied archive in `assets/fonts/Anola-Regular.otf` and used for the hero, community heading and CTA. Font provenance and SHA-256 are in `assets/fonts/manifest.json`. Sofia Pro Regular, Light and ExtraLight are still pending: the supplied Sofia Regular archive is a different family and has not been substituted. Body text currently uses an explicit system-font fallback and is not a final visual match. Existing ownership/licensing of imagery must also be confirmed before public distribution.

Native operating-system status bars and home indicators remain system-rendered. Their mock assets were not embedded into the app.
