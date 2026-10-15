import { sniffImageFormat, transformDesignImageMeta, toUploadBody } from '@/lib/imageTransform'
const MAX_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

export async function validatedImage(file, options) {
  return (await validatedImageMeta(file, options)).bytes
}

export async function validatedImageMeta(file, options) {
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') throw new Error('No file provided')
  if (!ALLOWED_TYPES.has(file.type)) throw new Error('Unsupported file type')
  if (!file.size || file.size > MAX_SIZE_BYTES) throw new Error('File must be between 1 byte and 10MB')
  const rawBuffer = Buffer.from(await file.arrayBuffer())

  // Validate the bytes before invoking a decoder; browser MIME labels are
  // untrusted. In particular, AVIF/HEIF must not reach the native decoder.
  const detected = sniffImageFormat(rawBuffer)
  if (!detected || file.type !== `image/${detected}`) {
    throw new Error('Image content does not match an allowed file type')
  }

  // Strip metadata and bound stored dimensions, using only the first frame.
  try {
    const { buffer, width, height } = await transformDesignImageMeta(rawBuffer, options)
    return { bytes: toUploadBody(buffer), width, height }
  } catch (err) {
    throw new Error('Failed to process image', { cause: err })
  }

}
