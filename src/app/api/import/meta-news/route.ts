import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
}

function cleanInlineText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function parseDate(dateText: string | undefined) {
  if (!dateText) return null
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function toAbsoluteUrl(url: string | undefined, baseUrl: string) {
  if (!url) return null
  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return null
  }
}

function extractCoverImage($: cheerio.CheerioAPI, fullUrl: string) {
  const ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="og:image"]').attr('content') ||
    $('meta[property="twitter:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content')

  const absoluteOgImage = toAbsoluteUrl(ogImage, fullUrl)
  if (absoluteOgImage) return absoluteOgImage

  const firstImage =
    $('article img').first().attr('src') ||
    $('main img').first().attr('src') ||
    $('[role="main"] img').first().attr('src') ||
    $('img').first().attr('src')

  return toAbsoluteUrl(firstImage, fullUrl)
}

async function fetchMetaDetail(fullUrl: string) {
  try {
    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        title: null,
        cover_image: null,
        published_at: null,
        author: null,
      }
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const pageTitle = cleanInlineText($('title').text())
      .replace(/\s*\|\s*Meta AI\s*$/i, '')
      .replace(/\s*\|\s*AI at Meta\s*$/i, '')
      .replace(/\s*\|\s*Meta\s*$/i, '')

    const coverImage = extractCoverImage($, fullUrl)

    const publishedAt =
      parseDate(
        $('meta[property="article:published_time"]').attr('content') ||
        $('meta[name="article:published_time"]').attr('content') ||
        $('time').first().attr('datetime') ||
        cleanInlineText($('time').first().text())
      )

    const author =
      cleanInlineText($('[rel="author"]').first().text()) ||
      cleanInlineText($('.author').first().text()) ||
      'Meta AI'

    return {
      title: pageTitle || null,
      cover_image: coverImage,
      published_at: publishedAt,
      author: author || 'Meta AI',
    }
  } catch {
    return {
      title: null,
      cover_image: null,
      published_at: null,
      author: null,
    }
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const listUrl = 'https://ai.meta.com/blog/'

    const response = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Meta AI 列表页抓取失败，状态码 ${response.status}` },
        { status: 500 }
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const rawItems: Array<{
      title: string
      href: string
    }> = []

    $('a').each((_, el) => {
      const href = $(el).attr('href')
      const text = cleanInlineText($(el).text())

      if (!href || !text) return

      const fullUrl = toAbsoluteUrl(href, listUrl)
      if (!fullUrl) return

      if (!fullUrl.startsWith('https://ai.meta.com/blog/')) return
      if (fullUrl === 'https://ai.meta.com/blog/' || fullUrl === 'https://ai.meta.com/blog') return

      if (text.length < 12) return
      if (/read more/i.test(text)) return

      rawItems.push({
        title: text,
        href: fullUrl,
      })
    })

    const uniqueItems = Array.from(
      new Map(rawItems.map((item) => [`meta:${item.href}`, item])).values()
    ).slice(0, 40)

    let inserted = 0
    let skipped = 0
    const errors: Array<{ external_id: string; message: string }> = []

    for (const rawItem of uniqueItems) {
      const detail = await fetchMetaDetail(rawItem.href)

      const finalTitle = detail.title || rawItem.title

      const record = {
        title: finalTitle,
        slug: slugify(finalTitle),
        published_at: detail.published_at,
        source: 'Meta AI',
        source_url: rawItem.href,
        external_id: `meta:${rawItem.href}`,
        summary: 'Meta AI 官方新闻，点击查看原文。',
        content: '',
        status: '已发布',
        author: detail.author || 'Meta AI',
        cover_image: detail.cover_image,
        category: 'Meta AI',
      }

      const { error } = await supabase.from('news').upsert(record, {
        onConflict: 'external_id',
        ignoreDuplicates: false,
      })

      if (error) {
        console.error('写入失败:', record.external_id, error.message)
        errors.push({
          external_id: record.external_id,
          message: error.message,
        })
        skipped += 1
      } else {
        inserted += 1
      }
    }

    return NextResponse.json({
      message: 'Meta AI 采集完成',
      total_found: uniqueItems.length,
      inserted,
      skipped,
      errors,
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
