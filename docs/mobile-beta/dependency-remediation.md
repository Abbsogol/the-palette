# Dependency remediation (F03)

Checked 13 October 2026 with Node 24.20.0. [Audit snapshots and release-bundle inspection](dependency-audit-2026-10-13.json) preserve full before/after npm results, including residual findings and npm's proposed remedies. This is a dated assessment, not a claim that all dependencies are vulnerability-free.

## Compatible changes

| Dependency | Before | After | Reason |
| --- | --- | --- | --- |
| Next, @next/env, eslint-config-next | 16.3.6 | 16.3.8 | Same minor release, matching runtime/lint versions. Addresses the six Next advisories reported by the audit. [Next release](https://github.com/vercel/next.js/releases/tag/v16.3.8), [image SSRF advisory](https://github.com/advisories/GHSA-cjq9-62q9-8jv4). |
| sharp | 0.35.4 | 0.35.5 | Patch release using updated prebuilt image libraries. The loaded binary reports librsvg 2.63.2 and libvips 8.18.7. [Maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w). |
| Mobile shell-quote | 1.10.0 | 1.12.0 | Fits react-devtools-core's existing `^1.6.1` range. Fix is available from 1.11.0; all four line terminators after a comment are rejected in real-package regression tests. [Maintainer advisory](https://github.com/ljharb/shell-quote/security/advisories/GHSA-pqg4-j6r4-53mv). |
| source-map-js, both projects | 1.2.1 | 1.2.2 | Compatible transitive patch for indexed source-map offset validation. [Advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q). |
| Expo and SDK packages | SDK 57 patch versions | SDK 57.0.28 and recommended patches | Expo's compatibility check found existing patch drift. `expo install --fix` aligned the SDK 57 dependencies, including jest-expo 57.0.6; React Native remains 0.86.3. [Expo upgrade guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/). |

No force audit fix, framework downgrade, SDK major upgrade, manual node_modules patch or new dependency override was used. Both lockfiles include integrity hashes, and fresh `npm ci` installs succeeded.

## Actual exposure

Next is server runtime software. No custom remote image allowlist, `use cache`/Draft Mode or dynamic metadata image route was found; these narrower preconditions reduce some exposures, but all audited Next issues were patched rather than left to configuration assumptions. The App Router's rendered pages still warrant the cache fixes.

Sharp processes uploaded image bytes on the server in the ordinary upload and admin media paths. The ordinary upload path checks magic bytes before decoding and rejects SVG/AVIF/HEIF; admin media can accept other image formats. Updating the native image libraries is therefore necessary. Existing real-decoder tests cover allowed image transcoding, dimensions and rejected mislabeled input. The lockfile also updates the Linux prebuilt packages used by hosting.

Shell-quote is reached through React Native development tools. It is patched even though it is absent from the release app's source-map module graph. No shell command is executed by the regression tests.

## Residual findings and disposition

Full root audit: **5 high package entries**, down from 8. Root `--omit=dev`: **0 findings**. Full mobile audit: **50 high and 5 moderate package entries, 0 critical**, down from 52 high, 5 moderate and 1 critical at the start of this task. These are npm's dependency-chain rollups; the residuals originate from three distinct unpatched advisories, not 60 distinct vulnerabilities.

Mobile `--omit=dev` still includes findings because Expo/React Native list CLI and test-preset dependencies in their production dependency graphs. That npm classification does not establish that the library ships in the app. Both release exports were inspected: Android has 1,950 modules and iOS 1,824; neither source-map graph contains braces, node-forge or sprintf-js.

| Unpatched library | Observed paths | Disposition and control | Reopen when |
| --- | --- | --- | --- |
| braces 3.0.3, high | Root Next ESLint plugin → fast-glob → micromatch; mobile Metro/Jest globs | No published fixed version. Retain the compatible toolchain; globs/configuration come from repository code, not app users. Keep CI isolated and timed, with no production credentials on untrusted PR jobs. Not present in either release mobile graph or root production dependency tree. [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). | A compatible upstream fix is published, or user-controlled glob/configuration is introduced. |
| node-forge 1.4.0, high | Expo CLI and @expo/code-signing-certificates | No published fixed version. Tooling certificate/signature validation remains a real concern; do not use it to authenticate untrusted certificates or production update signatures. This app has no expo-updates dependency or OTA signing configuration, and no node-forge module in either release export. [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv). | OTA/code-signing is enabled, untrusted signing inputs are accepted, or a patched upstream release becomes available. |
| sprintf-js 1.0.3, moderate | Jest instrumentation → js-yaml → argparse | No published fixed version. Keep formatting/CLI configuration developer-controlled; app text does not reach this formatter. Absent from release exports. A Jest major upgrade is not required merely to change this audit rollup. [Advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). | A compatible fix is available or external format strings reach this path. |

Engineering owns these follow-ups. The retained findings are recorded, not suppressed or described as fixed. npm's proposed Expo 44, Next ESLint 14 and old Stripe/Reanimated downgrades would break the current platform model and were rejected.

## Verification

Clean installs, root lint, 1,004 backend tests, web smoke build and 20 Chromium/WebKit browser tests pass. The two PGlite-only database races are unchanged and were executed on native PostgreSQL during F02. Mobile lint/typecheck and all 748 tests pass, including five shell-quote security/compatibility cases. Expo's SDK compatibility check passes; iOS and Android release JavaScript bundles export successfully, with the source-map inspection above.

The initial parallel mobile run terminated with SIGSEGV in the Node/Jest child process. A complete rerun with the same patched leaf versions passed all 743 existing tests; after SDK alignment and the new regression cases the full 748-test run passed. No tests were removed, deadlines relaxed or errors filtered to obtain the pass.

Fresh native CI verification of the SDK patch updates remains pending. No production deployment or signed store-build acceptance is implied by local checks.
