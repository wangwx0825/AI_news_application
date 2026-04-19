import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

export default async function AdminUsersPage() {
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

  const { data: adminUsers, error } = await supabase
    .from('admin_users')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">管理员管理</h1>

        <div className="flex items-center gap-4">
          <a
            href="/admin/users/new"
            className="inline-block rounded-lg bg-text px-4 py-2 text-sm text-white no-underline transition duration-300 hover:scale-105 hover:opacity-90"
          >
            + 新增管理员
          </a>

          <a
            href="/admin"
            className="inline-block text-sm text-link transition duration-300 hover:scale-110 hover:underline"
          >
            ← 返回后台首页
          </a>
        </div>
      </div>

      {error ? (
        <p>读取管理员列表失败：{error.message}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-white/80 shadow-lg">
          <table className="w-full border-collapse text-left">
            <thead className="bg-white/70">
              <tr>
                <th className="border-b border-border px-4 py-3">邮箱</th>
                <th className="border-b border-border px-4 py-3">创建时间</th>
                <th className="border-b border-border px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {adminUsers?.map((item) => (
                <tr key={item.id} className="hover:bg-white/60">
                  <td className="border-b border-border px-4 py-3">
                    {item.email}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    {String(item.created_at).slice(0, 10)}
                  </td>
                  <td className="border-b border-border px-4 py-3">
                    <a
                      href={`/admin/users/${item.id}/delete`}
                      className="inline-block text-sm text-red-600 transition duration-300 hover:scale-110 hover:underline"
                    >
                      删除
                    </a>
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