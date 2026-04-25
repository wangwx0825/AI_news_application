import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function AdminNewsPage() {
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
    .order('published_at', { ascending: false })

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">新闻管理</h1>

        <a
          href="/admin/news/new"
          className="inline-block rounded-lg bg-text px-4 py-2 text-sm text-white no-underline transition duration-300 hover:scale-105 hover:opacity-90"
        >
          + 新增新闻
        </a>
      </div>

      {error ? (
        <p>读取新闻失败：{error.message}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white/80 shadow-lg">
          <table className="w-full border-collapse text-left">
            <thead className="bg-white/70">
              <tr>
                <th className="border-b border-border px-4 py-3">标题</th>
                <th className="border-b border-border px-4 py-3">作者</th>
                <th className="border-b border-border px-4 py-3">状态</th>
                <th className="border-b border-border px-4 py-3">发布时间</th>
                <th className="border-b border-border px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {newsList?.map((item) => (
                <tr key={item.id} className="hover:bg-white/60">
                  <td className="border-b border-border px-4 py-3">
                    {item.title}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    {item.author ?? '未知'}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    {item.status ?? '未设置'}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    {item.published_at?.slice(0, 10)}
                  </td>
                  <td className="border-b border-border px-4 py-3">
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