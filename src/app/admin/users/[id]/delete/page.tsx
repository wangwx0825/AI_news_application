'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminDeleteUserPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [currentEmail, setCurrentEmail] = useState('')
  const [targetEmail, setTargetEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    async function checkAdminAndLoadUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('email')
        .eq('email', user.email)
        .single()

      if (!adminUser) {
        router.push('/')
        return
      }

      setCurrentEmail(user.email ?? '')

      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) {
        setErrorMessage('读取管理员信息失败')
        setCheckingAuth(false)
        return
      }

      setTargetEmail(data.email)
      setCheckingAuth(false)
    }

    checkAdminAndLoadUser()
  }, [id, router])

  async function handleDelete() {
    if (targetEmail === currentEmail) {
      setErrorMessage('不能删除当前登录的管理员账号。')
      return
    }

    setSubmitting(true)
    setErrorMessage('')

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSubmitting(false)
      router.push('/login')
      return
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single()

    if (!adminUser) {
      setSubmitting(false)
      router.push('/')
      return
    }

    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('id', id)

    setSubmitting(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    router.push('/admin/users')
    router.refresh()
  }

  if (checkingAuth) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p>检查权限中...</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-10">
      <div className="rounded-2xl border border-border bg-white/80 p-8 shadow-lg">
        <h1 className="mb-4 text-3xl font-bold text-red-600">删除管理员</h1>
        <p className="mb-6 text-sm leading-7 text-sub">
          你确定要删除管理员 <strong>{targetEmail || '（未知）'}</strong> 吗？此操作无法撤销。
        </p>

        {errorMessage ? (
          <p className="mb-4 text-sm text-red-600">{errorMessage}</p>
        ) : null}

        <div className="flex gap-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={submitting}
            className="rounded-lg bg-red-600 px-5 py-3 text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? '删除中...' : '确认删除'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/admin/users')}
            className="rounded-lg border border-border bg-white px-5 py-3 text-text transition hover:bg-white/80"
          >
            取消
          </button>
        </div>
      </div>
    </main>
  )
}