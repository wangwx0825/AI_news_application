import { NextResponse } from 'next/server'
import { authorizeCronRoute } from '@/lib/cron-route-auth'
import { runStabilityImport } from '@/lib/news-import/importers'

export async function POST(request: Request) {
  const authError = authorizeCronRoute(request)
  if (authError) return authError

  try {
    return NextResponse.json(await runStabilityImport())
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
