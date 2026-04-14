import Link from 'next/link'

export default function Home() {
  return (
    <div>
      <div className="text-center py-12 pb-6">
        <div className="font-serif text-3xl sm:text-4xl font-bold">
          Company<span className="text-accent">Wiki</span>
        </div>
        <p className="text-[15px] text-sub mt-2">企业知识库模板</p>
      </div>

      <div className="border-t border-border pt-8">
        <p className="text-[15px] text-sub text-center mb-8 leading-8">
          这是一个 Next.js + Supabase 的知识库脚手架，
          <br className="hidden sm:inline" />
          已内置 Wikipedia 风格的通用组件和设计系统，可用于快速构建新模块。
        </p>

        <div className="max-w-[400px] mx-auto">
          <Link
            href="/demo"
            className="block bg-card border border-border rounded-md p-5 hover:border-link transition-colors !no-underline"
          >
            <div className="font-bold mb-2 text-text">浏览示例页面 →</div>
            <div className="text-sm text-sub leading-7">
              展示 EntryLayout、Section、InfoCard、Tag 等通用组件的用法，
              新模块可以照此模板开发。
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
