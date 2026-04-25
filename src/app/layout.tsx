import './globals.css'
import Header from '@/components/Header'

export const metadata = {
  title: 'Company Wiki',
  description: 'AI 新闻聚合平台',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN">
      <body>
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