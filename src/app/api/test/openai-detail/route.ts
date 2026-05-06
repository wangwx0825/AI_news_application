import { NextRequest, NextResponse } from 'next/server'
import { authorizeDebugRoute } from '@/lib/debug-route-auth'
import {
  parseOpenAIMarkdownContent,
  toOpenAIReaderUrl,
} from '@/lib/news-import/openai'

export async function GET(request: NextRequest) {
  const authError = authorizeDebugRoute(request)
  if (authError) return authError

  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: '请提供 url 参数，例如 /api/test/openai-detail?url=https://openai.com/index/choco' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(toOpenAIReaderUrl(url), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `抓取失败，状态码 ${response.status}` },
        { status: 500 }
      )
    }

    const markdown = await response.text()
    const blocks = parseOpenAIMarkdownContent(markdown)
    const images = blocks.filter((block) => block.type === 'image')

    return NextResponse.json({
      url,
      reader_url: toOpenAIReaderUrl(url),
      block_preview: {
        paragraphs: blocks
          .filter((block) => block.type === 'paragraph')
          .map((block) => block.content)
          .slice(0, 8),
        images,
        tables: blocks.filter((block) => block.type === 'table'),
        code: blocks.filter((block) => block.type === 'code'),
      },
      summary: {
        total_blocks: blocks.length,
        paragraphs: blocks.filter((block) => block.type === 'paragraph').length,
        quotes: blocks.filter((block) => block.type === 'quote').length,
        headings: blocks.filter((block) => block.type === 'heading').length,
        images: images.length,
        tables: blocks.filter((block) => block.type === 'table').length,
        code: blocks.filter((block) => block.type === 'code').length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
