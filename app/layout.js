import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'The Palette',
  description: 'Nail and beauty design platform',
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
