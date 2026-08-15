import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Deliberately not using next/image: Vercel Hobby's Image Optimization
      // quota (5,000 transformations/month) is a real risk for a photo-heavy
      // app at this scale. Images are resized + compressed to WebP at upload
      // time instead (app/api/upload-design-photo), served via plain
      // <img loading="lazy">. Revisit next/image if/when on Vercel Pro.
      '@next/next/no-img-element': 'off',
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
