import sharp from 'sharp'

const MAX_DIMENSION = 1600
const MAX_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function validatedImage(file) {
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') throw new Error('No file provided')
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Unsupported file type')
  if (!file.size || file.size > MAX_SIZE_BYTES) throw new Error('File must be between 1 byte and 10MB')
  const rawBuffer = Buffer.from(await file.arrayBuffer())

  // Validate the bytes before invoking a decoder; browser MIME labels are
  // untrusted. In particular, AVIF/HEIF must not reach the native decoder.
  const detected = rawBuffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) ? 'jpeg'
    : rawBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
    : ['GIF87a', 'GIF89a'].includes(rawBuffer.toString('ascii', 0, 6)) ? 'gif'
    : rawBuffer.toString('ascii', 0, 4) === 'RIFF' && rawBuffer.toString('ascii', 8, 12) === 'WEBP' ? 'webp'
    : null
  if (!detected || file.type !== `image/${detected}`) {
    throw new Error('Image content does not match an allowed file type')
  }

  // Strip metadata and bound stored dimensions, using only the first frame.
  let webpBuffer
  try {
    const image = sharp(rawBuffer, { limitInputPixels: 40_000_000, failOn: 'warning' })
    const metadata = await image.metadata()
    if (metadata.format !== detected) throw new Error('Unsupported image content')
    webpBuffer = await image.rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
  } catch (err) {
    throw new Error('Failed to process image', { cause: err })
  }

  return new Uint8Array(webpBuffer)
}
