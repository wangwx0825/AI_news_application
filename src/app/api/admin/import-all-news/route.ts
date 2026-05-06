import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { logImportRun } from '@/lib/news-import/import-run-log'
import { runAllNewsImports } from '@/lib/news-import/run-all'

export const dynamic = 'force-dynamic'

async function authorizeAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: adminUser, error } = await supabase
    .from('admin_users')
    .select('email')
    .eq('email', user.email)
    .single()

  if (error || !adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return null
}

export async function POST(request: NextRequest) {
  const authError = await authorizeAdmin()
  if (authError) return authError

  const startedAt = new Date()
  const refreshExisting =
    new URL(request.url).searchParams.get('refresh') === '1'
  const result = await runAllNewsImports(refreshExisting)

  await logImportRun({
    triggerType: 'admin',
    startedAt,
    result,
  })

  return NextResponse.json({
    ...result,
    message: '管理员新闻采集完成',
  })
}
