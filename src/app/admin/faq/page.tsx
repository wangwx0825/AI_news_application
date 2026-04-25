import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function AdminFAQPage() {
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

  const { data: faqList, error } = await supabase
    .from('faq')
    .select('*')
    .order('updated_at', { ascending: false })

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">FAQ 管理</h1>

        <a
          href="/admin/faq/new"
          className="inline-block rounded-lg bg-text px-4 py-2 text-sm text-white no-underline transition duration-300 hover:scale-105 hover:opacity-90"
        >
          + 新增 FAQ
        </a>
      </div>

      {error ? (
        <p>读取 FAQ 失败：{error.message}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white/80 shadow-lg">
          <table className="w-full border-collapse text-left">
            <thead className="bg-white/70">
              <tr>
                <th className="border-b border-border px-4 py-3">问题</th>
                <th className="border-b border-border px-4 py-3">分类</th>
                <th className="border-b border-border px-4 py-3">更新时间</th>
                <th className="border-b border-border px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {faqList?.map((item) => (
                <tr key={item.id} className="hover:bg-white/60">
                  <td className="border-b border-border px-4 py-3">
                    {item.question}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    {item.category ?? '未分类'}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    {item.updated_at?.slice(0, 10)}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    <div className="flex gap-3">
                      <a
                        href={`/faq/${item.slug}`}
                        className="inline-block text-sm text-link transition duration-300 hover:scale-110 hover:underline"
                      >
                        查看
                      </a>
                      <a
                        href={`/admin/faq/${item.slug}/edit`}
                        className="inline-block text-sm text-link transition duration-300 hover:scale-110 hover:underline"
                      >
                        编辑
                      </a>
                      <a
                        href={`/admin/faq/${item.slug}/delete`}
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