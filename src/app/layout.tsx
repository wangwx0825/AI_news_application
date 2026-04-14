import type { Metadata, Viewport } from 'next'
import Header from '@/components/Header'
import './globals.css'

export const metadata: Metadata = {
  title: 'Company Wiki',
  description: '企业知识库模板',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Company Wiki',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#2a6496',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen" suppressHydrationWarning={true}>
        <div className="max-w-[960px] mx-auto px-4 sm:px-6">
          <Header />
          {children}
        </div>
      </body>
    </html>
  )
}
