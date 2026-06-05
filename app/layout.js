import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata = {
  title: 'Laque',
  description: 'A curated library of nail & beauty designs — browse, save, and discover with full specs.',
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
