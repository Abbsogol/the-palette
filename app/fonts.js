// The design's fonts — Anola (display) and Sofia Pro (UI) — are commercial.
// These are the free substitutes; when licensed, replace with next/font/local
// here and nothing else changes (everything consumes --font-display/--font-ui).
import { Prata, Jost } from 'next/font/google'

export const displayFont = Prata({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

export const uiFont = Jost({
  weight: ['300', '400', '500'],
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
})
