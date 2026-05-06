import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRoute } from '@/lib/cron-route-auth'
import { logImportRun } from '@/lib/news-import/import-run-log'
import { runAllNewsImports } from '@/lib/news-import/run-all'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authError = authorizeCronRoute(request)
  if (authError) return authError

  try {
    const startedAt = new Date()
    const refreshExisting = new URL(request.url).searchParams.get('refresh') === '1'
    const result = await runAllNewsImports(refreshExisting)

    await logImportRun({
      triggerType: 'cron',
      startedAt,
      result,
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
