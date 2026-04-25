import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'
import { XMLParser } from 'fast-xml-parser'

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

function stripHtml(html: string) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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

async function fetchHuggingFaceDetail(fullUrl: string) {
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
      .replace(/\s*\|\s*Hugging Face\s*$/i, '')

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
      cleanInlineText($('a[href^="/blog/"]').first().text()) ||
      'Hugging Face'

    return {
      title: pageTitle || null,
      cover_image: coverImage,
      published_at: publishedAt,
      author: author || 'Hugging Face',
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

type RssItem = {
  title: string
  link: string
  pubDate?: string
  description?: string
}

async function fetchHuggingFaceRssItems() {
  const rssUrl = 'https://huggingface.co/blog/feed.xml'

  const response = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Hugging Face RSS 抓取失败，状态码 ${response.status}`)
  }

  const xml = await response.text()

  const parser = new XMLParser({
    ignoreAttributes: false,
    trimValues: true,
  })

  const parsed = parser.parse(xml)
  const raw = parsed?.rss?.channel?.item ?? []
  const items = Array.isArray(raw) ? raw : [raw]

  return items
    .map((item: any) => ({
      title: cleanInlineText(item?.title || ''),
      link: item?.link || '',
      pubDate: item?.pubDate || item?.published || item?.date || '',
      description: stripHtml(item?.description || ''),
    }))
    .filter((item: RssItem) => item.title && item.link)
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
    const rawItems = (await fetchHuggingFaceRssItems()).slice(0, 60)

    const uniqueItems = Array.from(
      new Map(rawItems.map((item) => [`huggingface:${item.link}`, item])).values()
    )

    let inserted = 0
    let skipped = 0
    const errors: Array<{ external_id: string; message: string }> = []

    for (const rawItem of uniqueItems) {
      const detail = await fetchHuggingFaceDetail(rawItem.link)
      const finalTitle = detail.title || rawItem.title

      const record = {
        title: finalTitle,
        slug: slugify(finalTitle),
        published_at: detail.published_at || parseDate(rawItem.pubDate),
        source: 'Hugging Face',
        source_url: rawItem.link,
        external_id: `huggingface:${rawItem.link}`,
        summary: rawItem.description
          ? rawItem.description.slice(0, 220).trim()
          : 'Hugging Face 官方博客，点击查看原文。',
        content: '',
        status: '已发布',
        author: detail.author || 'Hugging Face',
        cover_image: detail.cover_image,
        category: 'Hugging Face',
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
      message: 'Hugging Face 采集完成',
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
