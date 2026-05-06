import { NextResponse, type NextRequest } from 'next/server'

export function authorizeDebugRoute(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Debug routes require CRON_SECRET in production.' },
        { status: 503 }
      )
    }

    return null
  }

  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
