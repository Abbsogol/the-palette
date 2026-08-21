import sharp from 'sharp'

// THE design-image pipeline — the single source of truth used by both the
// upload route and the legacy-image backfill script. Do not fork this logic:
// any divergence means backfilled images and fresh uploads stop matching.
export const MAX_DIMENSION = 1600 // longest edge — no stored photo needs more for a ≤480px column at up to ~3x DPR

export async function transformDesignImage(rawBuffer, { maxDimension = MAX_DIMENSION } = {}) {
  return sharp(rawBuffer)
    .resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer()
}

// Storage uploads must send a plain Uint8Array, never a Node Buffer. A
// Buffer (Node's Uint8Array subclass) was serialized differently by the
// fetch/undici stack on deployed Vercel and corrupted every upload byte-for-
// byte — deterministic in production, unreproducible locally (see the
// upload-webp-binary fix, 2026-08-15). Keep this conversion at the one place
// every caller goes through.
export const toUploadBody = (buffer) => new Uint8Array(buffer)
