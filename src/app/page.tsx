import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: latestNews } = await supabase
    .from('news')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(2)

  return (
    <div>
      <section className="rounded-3xl border border-white/60 bg-white/35 px-8 py-14 shadow-2xl backdrop-blur-xl sm:px-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <div className="inline-block rounded-full border border-border bg-bg px-3 py-1 text-sm text-sub">
              企业知识与新闻平台
            </div>

            <h1 className="mt-5 font-serif text-4xl font-bold leading-tight text-text sm:text-5xl">
              企业知识中心
            </h1>

            <p className="mt-4 text-lg leading-8 text-sub">
              统一展示公司新闻、知识词条与重要更新，
              <br className="hidden sm:block" />
              让团队更快找到信息，也让内容沉淀得更清晰。
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/news"
                className="inline-block rounded-md bg-text px-5 py-3 text-sm font-medium text-white no-underline transition duration-300 hover:scale-105 hover:opacity-90"
              >
                查看新闻
              </Link>

              <Link
                href="/demo"
                className="inline-block rounded-md border border-border px-5 py-3 text-sm font-medium text-text no-underline transition duration-300 hover:scale-105 hover:bg-bg"
              >
                浏览示例词条
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-6 text-sm text-sub">
              <div>
                <div className="text-2xl font-bold text-text">2+</div>
                <div>已上线模块</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-text">实时</div>
                <div>新闻更新展示</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-text">统一</div>
                <div>知识内容入口</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/50 bg-white/30 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <div className="text-sm text-sub">今日推荐</div>
                <div className="mt-1 text-xl font-bold text-text">
                  最新新闻预览
                </div>
              </div>
              <div className="rounded-full bg-card px-3 py-1 text-xs text-sub">
                News
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {latestNews?.length ? (
                latestNews.map((item) => (
                  <Link
                    key={item.id}
                    href={`/news/${item.slug}`}
                    className="group block overflow-hidden rounded-2xl border border-white/50 bg-white/60 no-underline shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-white/75 hover:shadow-xl"
                  >
                    {item.cover_image ? (
                      <img
                        src={item.cover_image}
                        alt={item.title}
                        className="h-44 w-full object-cover"
                      />
                    ) : null}

                    <div className="p-4">
                      <div className="text-sm text-sub">
                        {item.published_at?.slice(0, 10)}
                      </div>
                      <div className="mt-2 text-lg font-semibold text-text">
                        <span className="inline-block origin-left transition duration-300 group-hover:scale-105 group-hover:text-link">
                          {item.title}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-7 text-sub">
                        {item.summary}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-sub">
                  暂无新闻数据。
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        <a
          href="/news"
          className="group block rounded-2xl border border-white/50 bg-white/45 p-5 no-underline shadow-lg backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/65"
        >
          <div className="text-base font-semibold text-text">
            <span className="inline-block transition duration-300 group-hover:scale-105">
              新闻模块
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-sub">
            展示公司公告、产品更新和活动动态。
          </p>
        </a>

        <a
          href="/faq"
          className="group block rounded-2xl border border-white/50 bg-white/45 p-5 no-underline shadow-lg backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/65"
        >
          <div className="text-base font-semibold text-text">
            <span className="inline-block transition duration-300 group-hover:scale-105">
              FAQ 模块
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-sub">
            集中展示常见问题与解答，帮助成员快速找到使用说明和操作方法。
          </p>
        </a>

        <a
          href="/admin"
          className="group block rounded-2xl border border-white/50 bg-white/45 p-5 no-underline shadow-lg backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/65"
        >
          <div className="text-base font-semibold text-text">
            <span className="inline-block transition duration-300 group-hover:scale-105">
              持续扩展
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-sub">
            后续可以继续加入 FAQ、部门介绍和文档入口。
          </p>
        </a>
      </section>
    </div>
  )
}