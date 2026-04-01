import './globals.css'

export const metadata = {
  title: 'Noctis | Quantitative Market Intelligence',
  description: 'Real-time quantitative analysis and trade intelligence platform',
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
