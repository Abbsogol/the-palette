import { Platform, type TextStyle } from "react-native";

// Anola is bundled. Sofia Pro has not been supplied; keep one explicit body
// fallback per platform rather than letting individual tabs choose a font.
export const appFonts = {
  display: "Anola-Regular",
  regular: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif",
    default: "Arial",
  }),
  light: Platform.select({
    ios: "Avenir Next",
    android: "sans-serif-light",
    default: "Arial",
  }),
};

export const typography = {
  heading: {
    fontFamily: appFonts.display,
    fontWeight: "400",
    fontSize: 32,
    lineHeight: 38.4,
    letterSpacing: 0,
  },
  section: {
    fontFamily: appFonts.regular,
    fontWeight: "400",
    fontSize: 18,
    lineHeight: 22,
  },
  body: {
    fontFamily: appFonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: appFonts.light,
    fontSize: 14,
    lineHeight: 21,
  },
  button: {
    fontFamily: appFonts.regular,
    fontWeight: "400",
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
  },
} satisfies Record<string, TextStyle>;
