import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRoute } from '@/lib/cron-route-auth'
import { runAnthropicImport } from '@/lib/news-import/importers'
import { runScheduledImport } from '@/lib/news-import/scheduled-runner'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authError = authorizeCronRoute(request)
  if (authError) return authError

  try {
    const refreshExisting = new URL(request.url).searchParams.get('refresh') === '1'
    const anthropic = await runScheduledImport({
      name: 'Anthropic',
      runner: runAnthropicImport,
      importOptions: refreshExisting ? { refreshExisting: true } : undefined,
    })

    return NextResponse.json({
      message: 'Cron 执行完成',
      mode: refreshExisting ? 'full_refresh' : 'incremental',
      upstream_status: anthropic.status,
      result: anthropic.result,
      attempts: anthropic.attempts,
      duration_ms: anthropic.duration_ms,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
