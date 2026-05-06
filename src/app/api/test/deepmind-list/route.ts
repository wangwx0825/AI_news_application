import { NextRequest, NextResponse } from 'next/server'
import { authorizeDebugRoute } from '@/lib/debug-route-auth'
import { fetchDeepMindListItems } from '@/lib/news-import/deepmind'

export async function GET(request: NextRequest) {
  const authError = authorizeDebugRoute(request)
  if (authError) return authError

  try {
    const items = await fetchDeepMindListItems()

    return NextResponse.json({
      total: items.length,
      preview: items.slice(0, 15),
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
