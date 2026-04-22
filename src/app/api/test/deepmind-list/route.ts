import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

function cleanText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function toAbsoluteUrl(url: string | undefined, baseUrl: string) {
  if (!url) return null
  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const listUrl = 'https://deepmind.google/blog/'

    const response = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `DeepMind 列表页抓取失败，状态码 ${response.status}` },
        { status: 500 }
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const titles = $('h3')
      .map((_, el) => cleanText($(el).text()))
      .get()
      .filter(Boolean)

    const learnMoreLinks = $('a')
      .map((_, el) => {
        const text = cleanText($(el).text())
        const href = $(el).attr('href')
        if (!text.toLowerCase().includes('learn more')) return null
        return {
          text,
          href: toAbsoluteUrl(href, listUrl),
        }
      })
      .get()
      .filter(Boolean)

    const dateLines = $('body')
      .text()
      .split('\n')
      .map((line) => cleanText(line))
      .filter((line) =>
        /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i.test(line)
      )
      .slice(0, 20)

    return NextResponse.json({
      h3_count: titles.length,
      h3_preview: titles.slice(0, 15),
      learn_more_count: learnMoreLinks.length,
      learn_more_preview: learnMoreLinks.slice(0, 15),
      date_line_preview: dateLines,
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
