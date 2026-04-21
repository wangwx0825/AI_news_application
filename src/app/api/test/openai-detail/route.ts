import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

function cleanText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function cleanParagraph(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function GET() {
  try {
    const url = 'https://openai.com/index/scaling-codex-to-enterprises-worldwide'

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

    const title = cleanText($('title').text())

    const articleParagraphs = $('article p')
      .map((_, el) => cleanParagraph($(el).text()))
      .get()
      .filter(Boolean)

    const mainParagraphs = $('main p')
      .map((_, el) => cleanParagraph($(el).text()))
      .get()
      .filter(Boolean)

    const roleMainParagraphs = $('[role="main"] p')
      .map((_, el) => cleanParagraph($(el).text()))
      .get()
      .filter(Boolean)

    return NextResponse.json({
      url,
      title,
      article_p_count: articleParagraphs.length,
      article_p_preview: articleParagraphs.slice(0, 5),
      main_p_count: mainParagraphs.length,
      main_p_preview: mainParagraphs.slice(0, 5),
      role_main_p_count: roleMainParagraphs.length,
      role_main_p_preview: roleMainParagraphs.slice(0, 5),
      main_text_preview: cleanText($('main').text()).slice(0, 1500),
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
