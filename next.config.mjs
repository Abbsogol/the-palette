/** @type {import('next').NextConfig} */
const nextConfig = {
  // sharp's linux binding dlopens libvips-cpp.so from the separate
  // @img/sharp-libvips-linux-x64 package — a dynamic-library dependency the
  // file trace can't follow (it only traces the build platform's resolved
  // packages), so deployed functions crashed with ERR_DLOPEN_FAILED. Force
  // the linux-x64 pair into every sharp-importing route's output. The error
  // names the "linux-x64 runtime" (glibc), so the musl variants stay out.
  outputFileTracingIncludes: {
    '/api/upload-image': [
      './node_modules/@img/sharp-linux-x64/**/*',
      './node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
    '/api/publish-nail-lab-generation': [
      './node_modules/@img/sharp-linux-x64/**/*',
      './node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
    '/api/upload-challenge-photo': [
      './node_modules/@img/sharp-linux-x64/**/*',
      './node_modules/@img/sharp-libvips-linux-x64/**/*',
    ],
  },
};

export default nextConfig;
