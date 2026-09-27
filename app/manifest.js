export default function manifest() {
  return {
    name: 'laQue',
    short_name: 'laQue',
    description: 'A curated library of nail & beauty designs — browse, save, and discover with full specs.',
    start_url: '/',
    display: 'standalone',
    background_color: '#141414',
    theme_color: '#141414',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        // Dedicated full-bleed variant: the sphere sits in the 80% safe
        // zone on a wine field, so circular/squircle masks never clip it.
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
