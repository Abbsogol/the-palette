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

// Identify the actual image format from magic bytes — never trust the
// client-supplied MIME type. Returns 'jpeg' | 'png' | 'webp' | 'gif' | null.
export function sniffImageFormat(buffer) {
  if (buffer.length < 12) return null
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpeg'
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'png'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (buffer.toString('ascii', 0, 4) === 'GIF8') return 'gif'
  return null
}

// Storage uploads must send a plain Uint8Array, never a Node Buffer. A
// Buffer (Node's Uint8Array subclass) was serialized differently by the
// fetch/undici stack on deployed Vercel and corrupted every upload byte-for-
// byte — deterministic in production, unreproducible locally (see the
// upload-webp-binary fix, 2026-08-15). Keep this conversion at the one place
// every caller goes through.
export const toUploadBody = (buffer) => new Uint8Array(buffer)
