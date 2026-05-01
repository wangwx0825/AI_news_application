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

      <div className="mx-auto max-w-[1120px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="home-intel-shell relative overflow-hidden rounded-[28px] border border-white/55 bg-white/24 px-5 py-6 shadow-[0_18px_60px_rgba(36,42,52,0.08)] backdrop-blur-xl sm:px-8 sm:py-8 lg:px-10 lg:py-10">
          <div className="home-grid-overlay" aria-hidden="true" />
          <div className="home-scanline" aria-hidden="true" />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="home-rise relative rounded-[24px] border border-white/45 bg-white/20 p-7 shadow-[0_10px_34px_rgba(36,42,52,0.06)] backdrop-blur-md sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/42 px-3 py-1 text-sm text-sub backdrop-blur-sm">
                  <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_14px_rgba(200,85,58,0.55)]" />
                  AI 新闻聚合平台
                </div>
                <div className="rounded-full border border-white/45 bg-white/28 px-3 py-1 text-xs text-sub">
                  Live Briefing
                </div>
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

              <div className="mt-8 grid gap-2 text-xs text-sub sm:grid-cols-3">
                {['OpenAI', 'DeepMind', 'Meta AI'].map((source, index) => (
                  <div
                    key={source}
                    className="home-signal rounded-xl border border-white/45 bg-white/24 px-3 py-2"
                    style={{ animationDelay: `${index * 160}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{source}</span>
                      <span className="font-semibold text-link">SYNC</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="home-rise relative rounded-[24px] border border-white/45 bg-white/22 p-6 shadow-[0_10px_34px_rgba(36,42,52,0.06)] backdrop-blur-md [animation-delay:120ms]">
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
                    className="group block overflow-hidden rounded-2xl border border-white/45 bg-white/50 no-underline shadow-[0_10px_28px_rgba(36,42,52,0.07)] transition duration-300 hover:-translate-y-1 hover:bg-white/65 hover:shadow-[0_16px_34px_rgba(36,42,52,0.1)]"
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
                className="home-rise group block rounded-[24px] border border-white/45 bg-white/20 p-6 no-underline shadow-[0_10px_28px_rgba(36,42,52,0.06)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/36 hover:shadow-[0_16px_34px_rgba(36,42,52,0.09)]"
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
