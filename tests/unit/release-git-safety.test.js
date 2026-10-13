import { expect, it } from 'vitest';
import { prohibitedReleasePaths } from '../../scripts/release-git-safety.mjs';

it('rejects private configuration, generated native state, key material and phone screenshots', () => {
  const paths = ['.env.beta.local', 'mobile/.env.local', '.backups/catalog.sql', 'mobile/.expo/devices.json', '.vercel/project.json',
    'mobile/ios/LaQue.xcodeproj/project.pbxproj', 'mobile/android/gradle.properties', 'keys/signing.p8', 'keys/release.keystore',
    'docs/Screenshot 2026-10-13.png', 'docs/IMG_5497.PNG', 'test-results/payment/screenshot.png'];
  expect(prohibitedReleasePaths(paths)).toEqual(paths);
});

it('allows explicit templates and product assets without allowing arbitrary env files', () => {
  expect(prohibitedReleasePaths(['.env.example', 'mobile/.env.example', 'mobile/.env.production.example',
    'mobile/assets/figma/chat/manifest.json', 'mobile/assets/figma/chat/16999.png', 'public/hero-cosmic.png',
    'docs/mobile-beta/stripe-lab-sandbox.md', 'supabase/migrations/202610120041_lab_native_payments.sql'])).toEqual([]);
  expect(prohibitedReleasePaths(['docs/.env.example', '.env.testing', 'mobile/.env.preview'])).toHaveLength(3);
});
