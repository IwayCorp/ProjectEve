import './globals.css'

export const metadata = {
  title: 'Project Eve | Quantitative Market Intelligence',
  description: 'Real-time quantitative market analysis dashboard — TradingView-inspired',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
