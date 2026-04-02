import './globals.css'

export const metadata = {
  title: 'Noctis | Quantitative Market Intelligence',
  description: 'Real-time quantitative analysis and trade intelligence platform',
  icons: {
    icon: '/favicon.ico',
    apple: '/icon-192.png',
  },
  manifest: '/manifest.json',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const t = localStorage.getItem('noctis-theme');
            if (t === 'light') {
              document.documentElement.classList.remove('dark');
              document.documentElement.classList.add('light');
            }
          } catch {}
        ` }} />
      </head>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
