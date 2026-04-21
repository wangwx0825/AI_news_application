import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

function cleanText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function normalizeContent(text: string) {
  let cleaned = cleanText(text)

  cleaned = cleaned.replace(
    /^(Announcements|Product|Policy|Research)\s*/i,
    ''
  )

  cleaned = cleaned.replace(
    /^[A-Z].*?\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s*/i,
    ''
  )

  return cleaned.trim()
}

export async function GET() {
  try {
    const url = 'https://www.anthropic.com/news/australia-MOU'

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `抓取详情页失败，状态码 ${response.status}` },
        { status: 500 }
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const title = cleanText($('title').text()).replace(/\s*\\\s*Anthropic\s*$/, '')

    const candidates = [
      cleanText($('article').text()),
      cleanText($('main').text()),
      cleanText($('[role="main"]').text()),
      cleanText($('.prose').text()),
    ].filter(Boolean)

    const rawContent = candidates.sort((a, b) => b.length - a.length)[0] || ''
    const content = normalizeContent(rawContent)

    return NextResponse.json({
      url,
      title,
      raw_content_preview: rawContent.slice(0, 1200),
      cleaned_content_preview: content.slice(0, 1200),
      content_length: content.length,
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
