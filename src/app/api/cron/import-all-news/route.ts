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

    const [
      anthropicRes,
      openaiRes,
      deepmindRes,
      metaRes,
      huggingfaceRes,
      mistralRes,
      stabilityRes,
    ] = await Promise.all([
      fetch(`${baseUrl}/api/import/anthropic-news`, {
        method: 'POST',
        headers: { authorization: expected },
        cache: 'no-store',
      }),
      fetch(`${baseUrl}/api/import/openai-news`, {
        method: 'POST',
        headers: { authorization: expected },
        cache: 'no-store',
      }),
      fetch(`${baseUrl}/api/import/deepmind-news`, {
        method: 'POST',
        headers: { authorization: expected },
        cache: 'no-store',
      }),
      fetch(`${baseUrl}/api/import/meta-news`, {
        method: 'POST',
        headers: { authorization: expected },
        cache: 'no-store',
      }),
      fetch(`${baseUrl}/api/import/huggingface-news`, {
        method: 'POST',
        headers: { authorization: expected },
        cache: 'no-store',
      }),
      fetch(`${baseUrl}/api/import/mistral-news`, {
        method: 'POST',
        headers: { authorization: expected },
        cache: 'no-store',
      }),
      fetch(`${baseUrl}/api/import/stability-news`, {
        method: 'POST',
        headers: { authorization: expected },
        cache: 'no-store',
      }),
    ])

    const anthropicData = await anthropicRes.json()
    const openaiData = await openaiRes.json()
    const deepmindData = await deepmindRes.json()
    const metaData = await metaRes.json()
    const huggingfaceData = await huggingfaceRes.json()
    const mistralData = await mistralRes.json()
    const stabilityData = await stabilityRes.json()

    return NextResponse.json({
      message: '全部新闻采集完成',
      anthropic: {
        status: anthropicRes.status,
        result: anthropicData,
      },
      openai: {
        status: openaiRes.status,
        result: openaiData,
      },
      deepmind: {
        status: deepmindRes.status,
        result: deepmindData,
      },
      meta: {
        status: metaRes.status,
        result: metaData,
      },
      huggingface: {
        status: huggingfaceRes.status,
        result: huggingfaceData,
      },
      mistral: {
        status: mistralRes.status,
        result: mistralData,
      },
      stability: {
        status: stabilityRes.status,
        result: stabilityData,
      },
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