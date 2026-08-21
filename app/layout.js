import './globals.css'
import { displayFont, uiFont } from './fonts'
import BottomNav from '@/components/BottomNav'
import { Analytics } from '@vercel/analytics/react'

const APP_URL = 'https://laque.app'

export const metadata = {
  title: 'Laque',
  description: 'A curated library of nail & beauty designs — browse, save, and discover with full specs.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: 'Laque — Nail & Beauty Design Library',
    description: 'Browse hundreds of curated nail designs, each with full colour codes, techniques, and specs. Save your favourites and share with your nail tech.',
    url: APP_URL,
    siteName: 'Laque',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'Laque — Nail & Beauty Design Library',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Laque — Nail & Beauty Design Library',
    description: 'Browse hundreds of curated nail designs with full specs. Save and share with your nail tech.',
    images: ['/og-image.jpg'],
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }) {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  return (
    <html lang="en" className={`${displayFont.variable} ${uiFont.variable}`}>
      <body>
        {/* Warm the storage origin before the first design image request —
            saves DNS+TLS on the largest first-paint asset. React hoists
            these into <head>. */}
        {supabaseOrigin && <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />}
        {supabaseOrigin && <link rel="dns-prefetch" href={supabaseOrigin} />}
        <main style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))', minHeight: '100vh' }}>
          {children}
        </main>
        <BottomNav />
        <Analytics />
      </body>
    </html>
  )
}
