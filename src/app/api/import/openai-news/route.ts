import { NextRequest, NextResponse } from 'next/server'
import { authorizeCronRoute } from '@/lib/cron-route-auth'
import { runOpenAIImport } from '@/lib/news-import/importers'

export async function POST(request: NextRequest) {
  const authError = authorizeCronRoute(request)
  if (authError) return authError

  try {
    return NextResponse.json(await runOpenAIImport())
  } catch (error) {
    console.error('OpenAI import failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}
