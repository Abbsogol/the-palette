# Main V2 — Filter assets

Source: [Figma Main V2 - Filter, 345:3470](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3470), retrieved through the authenticated Figma connector on 2026-09-28.

- `102c4.png`: original Figma hero source, rendered with its 180-degree rotation and a cover crop. Used after the owner requested removing the white strip, so rounded-corner pixels from the old layer export do not show at the screen edges.
- `hero.png`: retained reference export of image-only layer 345:3472, preserving its crop, rotation and image adjustments. It contains no interactive UI.
- `8062b.png`, `79f04.png`: story photographs. `b6228.png`: Retro Checker. These sample catalog assets appear only in the development preview.
- `38c1e.svg`, `cbb9b.svg`: original 16×16 header bell/star. `fadbd.svg`: original 18×18 story plus.
- Unchanged background, navigation, save icons and other catalog photos reuse the identical assets in `../home-main/`.

The manifest records local file sizes and SHA-256 hashes. Temporary Figma URLs are not used at runtime. No status-bar or full-screen screenshot is embedded in the app. Body fonts remain explicit fallbacks until Sofia Pro Regular, Light and Medium are provided; Anola Regular is bundled from the owner's archive.
