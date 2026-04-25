import Link from 'next/link'
import BackgroundVideo from '@/components/BackgroundVideo'
import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data: latestNews } = await supabase
    .from('news')
    .select('*')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(3)

  const featuredNews = latestNews?.[0]
  const secondaryNews = latestNews?.slice(1) ?? []

  return (
    <div className="relative min-h-screen">
      <BackgroundVideo />

      <div className="mx-auto max-w-[1080px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-white/50 bg-white/20 px-5 py-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] backdrop-blur-xl sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-[28px] border border-white/45 bg-white/16 p-7 shadow-[0_8px_30px_rgba(0,0,0,0.05)] backdrop-blur-md sm:p-8">
              <div className="inline-block rounded-full border border-border/70 bg-white/35 px-3 py-1 text-sm text-sub backdrop-blur-sm">
                AI 新闻聚合平台
              </div>

              <h1 className="mt-5 font-serif text-4xl font-bold leading-tight text-text sm:text-5xl">
                AI 资讯中心
              </h1>

              <p className="mt-5 text-lg leading-8 text-sub">
                聚合多个 AI 官方来源的最新新闻与重要动态，
                <br className="hidden sm:block" />
                帮助你更高效地获取行业资讯。
              </p>

              <div className="mt-10 grid grid-cols-3 gap-6 text-sm text-sub">
                <div>
                  <div className="text-2xl font-bold text-text">7+</div>
                  <div className="mt-1">新闻来源接入</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-text">每日</div>
                  <div className="mt-1">自动更新抓取</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-text">统一</div>
                  <div className="mt-1">资讯内容入口</div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/45 bg-white/18 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.05)] backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/35 pb-4">
                <div>
                  <div className="text-sm text-sub">今日精选</div>
                  <div className="mt-1 text-xl font-bold text-text">
                    最新新闻预览
                  </div>
                </div>

                <Link
                  href="/news"
                  className="rounded-full border border-white/40 bg-white/35 px-3 py-1 text-xs text-sub no-underline transition duration-300 hover:bg-white/60 hover:text-link"
                >
                  查看全部新闻
                </Link>
              </div>

              <div className="mt-5">
                {featuredNews ? (
                  <Link
                    href={`/news/${featuredNews.slug}`}
                    className="group block overflow-hidden rounded-2xl border border-white/45 bg-white/45 no-underline shadow-[0_8px_24px_rgba(0,0,0,0.05)] transition duration-300 hover:-translate-y-1 hover:bg-white/60 hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
                  >
                    {featuredNews.cover_image ? (
                      <img
                        src={featuredNews.cover_image}
                        alt={featuredNews.title}
                        className="h-56 w-full object-cover"
                      />
                    ) : null}

                    <div className="p-5">
                      <div className="text-sm text-sub">
                        {featuredNews.source ?? '未知来源'}
                        {featuredNews.published_at
                          ? ` · ${featuredNews.published_at.slice(0, 10)}`
                          : ''}
                      </div>

                      <div className="mt-3 text-2xl font-semibold leading-tight text-text">
                        <span className="inline-block origin-left transition duration-300 group-hover:scale-[1.02] group-hover:text-link">
                          {featuredNews.title}
                        </span>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="rounded-xl border border-white/35 bg-white/35 p-4 text-sm text-sub backdrop-blur-sm">
                    暂无新闻数据。
                  </div>
                )}
              </div>
            </div>

            {secondaryNews.map((item) => (
              <Link
                key={item.id}
                href={`/news/${item.slug}`}
                className="group block rounded-[28px] border border-white/45 bg-white/18 p-6 no-underline shadow-[0_8px_24px_rgba(0,0,0,0.05)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/32 hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)]"
              >
                <div className="text-sm text-sub">
                  {item.source ?? '未知来源'}
                  {item.published_at ? ` · ${item.published_at.slice(0, 10)}` : ''}
                </div>

                <div className="mt-3 line-clamp-3 text-2xl font-semibold leading-tight text-text transition duration-300 group-hover:text-link">
                  {item.title}
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}