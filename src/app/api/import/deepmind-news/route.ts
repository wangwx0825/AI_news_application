import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRoute } from '@/lib/cron-route-auth'
import { runDeepMindImport } from '@/lib/news-import/importers'

export async function POST(request: NextRequest) {
  const authError = authorizeCronRoute(request)
  if (authError) return authError

  try {
    return NextResponse.json(await runDeepMindImport())
  } catch (error) {
    console.error('DeepMind import failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
