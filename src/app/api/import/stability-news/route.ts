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

function extractDetailDate($: cheerio.CheerioAPI) {
  const candidates = [
    $('meta[property="article:published_time"]').attr('content'),
    $('meta[name="article:published_time"]').attr('content'),
    $('time').first().attr('datetime'),
    cleanInlineText($('time').first().text()),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const parsed = parseDate(candidate)
    if (parsed) return parsed
  }

  const bodyText = cleanInlineText($('body').text())
  const match = bodyText.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/
  )

  if (match) {
    return parseDate(match[0])
  }

  return null
}

function extractAuthor($: cheerio.CheerioAPI) {
  const selectors = [
    'article [rel="author"]',
    'main [rel="author"]',
    '[role="main"] [rel="author"]',
    'article .author',
    'main .author',
    '[class*="author"]',
  ]

  for (const selector of selectors) {
    const text = cleanInlineText($(selector).first().text())
    if (text && text.length < 120) {
      return text
    }
  }

  const bodyText = cleanInlineText($('body').text())
  const byMatch = bodyText.match(/Written By\s+([A-Z][A-Za-z\s,&.'-]{2,100})|By\s+([A-Z][A-Za-z\s,&.'-]{2,100})/)
  if (byMatch?.[1]) return cleanInlineText(byMatch[1])
  if (byMatch?.[2]) return cleanInlineText(byMatch[2])

  return 'Stability AI'
}

function inferCategory(text: string) {
  const lower = text.toLowerCase()

  if (lower.includes('research')) return 'Research'
  if (lower.includes('product')) return 'Product'
  if (lower.includes('company')) return 'Company'
  if (lower.includes('community')) return 'Community'
  if (lower.includes('audio')) return 'Audio'
  if (lower.includes('video')) return 'Video'
  if (lower.includes('image')) return 'Image'
  return 'Stability AI'
}

async function fetchStabilityDetail(fullUrl: string) {
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
      .replace(/\s*\|\s*Stability AI\s*$/i, '')

    const coverImage = extractCoverImage($, fullUrl)
    const publishedAt = extractDetailDate($)
    const author = extractAuthor($)

    return {
      title: pageTitle || null,
      cover_image: coverImage,
      published_at: publishedAt,
      author: author || 'Stability AI',
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

async function fetchStabilityListItems() {
  const listUrl = 'https://stability.ai/news-updates'

  const response = await fetch(listUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Stability AI 列表页抓取失败，状态码 ${response.status}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: Array<{
    title: string
    href: string
    category: string
  }> = []

  $('a').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return

    const fullUrl = toAbsoluteUrl(href, listUrl)
    if (!fullUrl) return

    if (!fullUrl.startsWith('https://stability.ai/news-updates/')) return
    if (fullUrl === 'https://stability.ai/news-updates/' || fullUrl === 'https://stability.ai/news-updates') return
    if (fullUrl.includes('/category/')) return

    const text = cleanInlineText($(el).text())
    if (!text || text.length < 12) return
    if (/read more|older posts|learn more|submit a support request/i.test(text)) return

    items.push({
      title: text,
      href: fullUrl,
      category: inferCategory(text),
    })
  })

  return Array.from(
    new Map(items.map((item) => [`stability:${item.href}`, item])).values()
  ).slice(0, 50)
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
    const rawItems = await fetchStabilityListItems()

    let inserted = 0
    let skipped = 0
    const errors: Array<{ external_id: string; message: string }> = []

    for (const rawItem of rawItems) {
      const detail = await fetchStabilityDetail(rawItem.href)
      const finalTitle = detail.title || rawItem.title

      const record = {
        title: finalTitle,
        slug: slugify(finalTitle),
        published_at: detail.published_at,
        source: 'Stability AI',
        source_url: rawItem.href,
        external_id: `stability:${rawItem.href}`,
        summary: 'Stability AI 官方新闻，点击查看原文。',
        content: '',
        status: '已发布',
        author: detail.author || 'Stability AI',
        cover_image: detail.cover_image,
        category: rawItem.category,
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
      message: 'Stability AI 采集完成',
      total_found: rawItems.length,
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
