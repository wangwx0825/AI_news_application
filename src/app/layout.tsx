import './globals.css'
import Header from '@/components/Header'
import PwaRegister from '@/components/PwaRegister'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  manifest: '/manifest.json',
  title: 'Company Wiki',
  description: 'AI 新闻聚合平台',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Company Wiki',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
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
    <html lang="zh-CN">
      <body>
        <PwaRegister />
        <div className="relative z-10">
          <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
            <Header />
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
