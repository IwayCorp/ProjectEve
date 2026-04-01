import './globals.css'

export const metadata = {
  title: 'Project Eve | Market Intelligence',
  description: 'Real-time quantitative market analysis dashboard',
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
