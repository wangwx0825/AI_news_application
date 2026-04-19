import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import AdminLogoutButton from '@/components/AdminLogoutButton'

export default async function AdminPage() {
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

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">后台管理</h1>
        <AdminLogoutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <a
          href="/admin/news"
          className="group block rounded-2xl border border-border bg-white/80 p-6 no-underline shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-white/90"
        >
          <div className="text-xl font-semibold text-text">
            <span className="inline-block transition duration-300 group-hover:scale-105">
              新闻管理
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-sub">
            查看、维护和管理新闻内容。
          </p>
        </a>

        <a
          href="/admin/faq"
          className="group block rounded-2xl border border-border bg-white/80 p-6 no-underline shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-white/90"
        >
          <div className="text-xl font-semibold text-text">
            <span className="inline-block transition duration-300 group-hover:scale-105">
              FAQ 管理
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-sub">
            查看、维护和管理常见问题内容。
          </p>
        </a>

        <a
          href="/admin/users"
          className="group block rounded-2xl border border-border bg-white/80 p-6 no-underline shadow-lg transition duration-300 hover:-translate-y-1 hover:bg-white/90"
        >
          <div className="text-xl font-semibold text-text">
            <span className="inline-block transition duration-300 group-hover:scale-105">
              管理员管理
            </span>
          </div>
          <p className="mt-2 text-sm leading-7 text-sub">
            查看和维护后台管理员账户列表。
          </p>
        </a>
      </div>
    </main>
  )
}