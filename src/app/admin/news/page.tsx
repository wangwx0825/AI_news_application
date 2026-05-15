import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

type AdminNewsPageProps = {
  searchParams?: Promise<{
    sort?: string
  }>
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '暂无'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 16)

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export default async function AdminNewsPage({
  searchParams,
}: AdminNewsPageProps) {
  const resolvedSearchParams = await searchParams
  const sortMode =
    resolvedSearchParams?.sort === 'created_at' ? 'created_at' : 'published_at'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('email')
    .eq('email', user.email)
    .single()

  if (!adminUser) {
    redirect('/')
  }

  const { data: newsList, error } = await supabase
    .from('news')
    .select('*')
    .order(sortMode, { ascending: false, nullsFirst: false })
    .order(sortMode === 'created_at' ? 'published_at' : 'created_at', {
      ascending: false,
      nullsFirst: false,
    })

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">新闻管理</h1>
          <p className="mt-2 text-sm text-sub">
            {sortMode === 'created_at'
              ? '当前按采集时间排序，方便查看刚刚入库的新闻。'
              : '当前按原文发布时间排序，和前台新闻列表逻辑一致。'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border bg-white/70 p-1 text-sm">
            <a
              href="/admin/news"
              className={`rounded-md px-3 py-2 no-underline transition ${
                sortMode === 'published_at'
                  ? 'bg-text text-white'
                  : 'text-sub hover:bg-white'
              }`}
            >
              按发布时间
            </a>
            <a
              href="/admin/news?sort=created_at"
              className={`rounded-md px-3 py-2 no-underline transition ${
                sortMode === 'created_at'
                  ? 'bg-text text-white'
                  : 'text-sub hover:bg-white'
              }`}
            >
              按采集时间
            </a>
          </div>

          <a
            href="/admin/news/new"
            className="inline-block rounded-lg bg-text px-4 py-2 text-sm text-white no-underline transition duration-300 hover:scale-105 hover:opacity-90"
          >
            + 新增新闻
          </a>
        </div>
      </div>

      {error ? (
        <p>读取新闻失败：{error.message}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-white/80 shadow-lg">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-white/70">
              <tr>
                <th className="border-b border-border px-4 py-3">标题</th>
                <th className="border-b border-border px-4 py-3">作者</th>
                <th className="border-b border-border px-4 py-3">状态</th>
                <th className="border-b border-border px-4 py-3">发布时间</th>
                <th className="border-b border-border px-4 py-3">采集时间</th>
                <th className="border-b border-border px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {newsList?.map((item) => (
                <tr key={item.id} className="hover:bg-white/60">
                  <td className="border-b border-border px-4 py-3 align-top">
                    {item.title}
                  </td>
                  <td className="border-b border-border px-4 py-3 align-top">
                    {item.author ?? '未知'}
                  </td>
                  <td className="border-b border-border px-4 py-3 align-top">
                    {item.status ?? '未设置'}
                  </td>
                  <td className="whitespace-nowrap border-b border-border px-4 py-3 align-top">
                    {item.published_at?.slice(0, 10) ?? '暂无日期'}
                  </td>
                  <td className="whitespace-nowrap border-b border-border px-4 py-3 align-top">
                    {formatDateTime(item.created_at)}
                  </td>
                  <td className="border-b border-border px-4 py-3 align-top">
                    <div className="flex gap-3">
                      <a
                        href={`/news/${item.slug}`}
                        className="inline-block text-sm text-link transition duration-300 hover:scale-110 hover:underline"
                      >
                        查看
                      </a>
                      <a
                        href={`/admin/news/${item.slug}/edit`}
                        className="inline-block text-sm text-link transition duration-300 hover:scale-110 hover:underline"
                      >
                        编辑
                      </a>
                      <a
                        href={`/admin/news/${item.slug}/delete`}
                        className="inline-block text-sm text-red-600 transition duration-300 hover:scale-110 hover:underline"
                      >
                        删除
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
