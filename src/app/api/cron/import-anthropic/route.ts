import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET 未配置' },
      { status: 500 }
    )
  }

  if (authHeader !== expected) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      new URL(request.url).origin

    const response = await fetch(`${baseUrl}/api/import/anthropic-news`, {
      method: 'POST',
      headers: {
        authorization: expected,
      },
      cache: 'no-store',
    })

    const data = await response.json()

    return NextResponse.json({
      message: 'Cron 执行完成',
      upstream_status: response.status,
      result: data,
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
