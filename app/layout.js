import './globals.css'
import BottomNav from '@/components/BottomNav'

const APP_URL = 'https://the-palette-one.vercel.app'

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
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main style={{ paddingBottom: '80px', minHeight: '100vh' }}>
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
