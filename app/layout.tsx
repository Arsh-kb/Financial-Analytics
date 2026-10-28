import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono, Outfit } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const _jetbrains = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })
const _outfit = Outfit({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] })

export const metadata: Metadata = {
  title: 'Campus Commerce — Student Intelligence Dashboard',
  description: 'A futuristic campus commerce intelligence dashboard built from student shopping behavior data.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased grain">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
