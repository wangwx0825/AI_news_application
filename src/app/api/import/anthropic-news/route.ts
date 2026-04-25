import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type AnthropicDetailResult = {
  title: string | null
  content: string
  cover_image: string | null
  author: string | null
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
}

function parseAnthropicDate(dateText: string) {
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function cleanInlineText(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function cleanParagraph(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeJoinedContent(text: string) {
  let cleaned = cleanInlineText(text)

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

function removeLeadingMetaFromParagraphs(paragraphs: string[]) {
  if (paragraphs.length === 0) return paragraphs

  const cleaned = [...paragraphs]

  cleaned[0] = cleaned[0]
    .replace(/^(Announcements|Product|Policy|Research)\s*/i, '')
    .replace(/^[A-Z].*?\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\s*/i, '')
    .trim()

  return cleaned.filter(Boolean)
}

function isLikelyBadSummary(text: string) {
  const cleaned = cleanInlineText(text)
  if (!cleaned) return true
  if (cleaned.length < 30) return true

  if (
    /^(Announcements|Product|Policy|Research)$/i.test(cleaned) ||
    /^(By\s+.+)$/i.test(cleaned)
  ) {
    return true
  }

  if (
    cleaned.length < 80 &&
    /^[A-Z][A-Za-z.'-]+(?:\s+(?:and|&)\s+|\s+)[A-Z][A-Za-z.'-]+/.test(cleaned) &&
    !/[.!?]/.test(cleaned)
  ) {
    return true
  }

  return false
}

function buildSummary(content: string, fallbackCategory: string) {
  if (!content) return `${fallbackCategory} | 来源：Anthropic`

  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  for (const paragraph of paragraphs) {
    if (!isLikelyBadSummary(paragraph)) {
      return paragraph.slice(0, 220).trim()
    }
  }

  return `${fallbackCategory} | 来源：Anthropic`
}

function extractParagraphs($: cheerio.CheerioAPI) {
  const selectors = [
    'article p',
    'main p',
    '[role="main"] p',
    '.prose p',
  ]

  for (const selector of selectors) {
    const paragraphs = $(selector)
      .map((_, el) => cleanParagraph($(el).text()))
      .get()
      .filter((text) => text.length > 0)

    if (paragraphs.length >= 3) {
      return removeLeadingMetaFromParagraphs(paragraphs)
    }
  }

  return []
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

  const firstArticleImage =
    $('article img').first().attr('src') ||
    $('main img').first().attr('src') ||
    $('[role="main"] img').first().attr('src') ||
    $('.prose img').first().attr('src')

  return toAbsoluteUrl(firstArticleImage, fullUrl)
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
    if (text && text.length < 120 && !isLikelyBadSummary(text)) {
      return text
    }
  }

  const bodyText = cleanInlineText($('body').text())

  const byMatch = bodyText.match(/By\s+([A-Z][A-Za-z\s,&.'-]{2,100})/)
  if (byMatch?.[1]) {
    return cleanInlineText(byMatch[1])
  }

  return null
}

async function fetchAnthropicDetail(fullUrl: string): Promise<AnthropicDetailResult> {
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
        content: '',
        cover_image: null,
        author: null,
      }
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const pageTitle = cleanInlineText($('title').text()).replace(
      /\s*\\\s*Anthropic\s*$/,
      ''
    )

    const coverImage = extractCoverImage($, fullUrl)
    const paragraphs = extractParagraphs($)
    const author = extractAuthor($)

    if (paragraphs.length > 0) {
      return {
        title: pageTitle || null,
        content: paragraphs.join('\n\n'),
        cover_image: coverImage,
        author,
      }
    }

    const fallbackCandidates = [
      cleanInlineText($('article').text()),
      cleanInlineText($('main').text()),
      cleanInlineText($('[role="main"]').text()),
      cleanInlineText($('.prose').text()),
    ].filter(Boolean)

    const rawContent =
      fallbackCandidates.sort((a, b) => b.length - a.length)[0] || ''

    return {
      title: pageTitle || null,
      content: normalizeJoinedContent(rawContent),
      cover_image: coverImage,
      author,
    }
  } catch {
    return {
      title: null,
      content: '',
      cover_image: null,
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
    const response = await fetch('https://www.anthropic.com/news', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `抓取失败，状态码 ${response.status}` },
        { status: 500 }
      )
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const rawItems: Array<{
      href: string
      rawText: string
    }> = []

    $('a[href^="/news/"]').each((_, el) => {
      const href = $(el).attr('href')
      const rawText = $(el).text().replace(/\s+/g, ' ').trim()

      if (!href || !rawText) return
      if (href === '/news') return

      const dateMatch = rawText.match(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/)
      if (!dateMatch) return

      rawItems.push({ href, rawText })
    })

    const uniqueRawItems = Array.from(
      new Map(rawItems.map((item) => [`anthropic:${item.href}`, item])).values()
    )

    let inserted = 0
    let skipped = 0
    const errors: Array<{ external_id: string; message: string }> = []

    for (const rawItem of uniqueRawItems) {
      const { href, rawText } = rawItem

      const dateMatch = rawText.match(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/)
      const dateText = dateMatch ? dateMatch[0] : ''
      const cleaned = rawText.replace(dateText, '').trim()

      const categories = ['Product', 'Announcements', 'Policy', 'Research']
      let category = 'News'
      let title = cleaned

      for (const c of categories) {
        if (cleaned.startsWith(c)) {
          category = c
          title = cleaned.slice(c.length).trim()
          break
        }
      }

      const fullUrl = `https://www.anthropic.com${href}`
      const externalId = `anthropic:${href}`

      const detail = await fetchAnthropicDetail(fullUrl)

      const finalTitle = detail.title || title
      const finalContent =
        detail.content || `${finalTitle}\n\n原文链接：${fullUrl}`

      const item = {
        title: finalTitle,
        slug: slugify(finalTitle),
        published_at: parseAnthropicDate(dateText),
        source: 'Anthropic',
        source_url: fullUrl,
        external_id: externalId,
        summary: buildSummary(finalContent, category),
        content: finalContent,
        status: '已发布',
        author: detail.author || 'Anthropic',
        cover_image: detail.cover_image,
      }

      const { error } = await supabase.from('news').upsert(item, {
        onConflict: 'external_id',
        ignoreDuplicates: false,
      })

      if (error) {
        console.error('写入失败:', externalId, error.message)
        errors.push({
          external_id: externalId,
          message: error.message,
        })
        skipped += 1
      } else {
        inserted += 1
      }
    }

    return NextResponse.json({
      message: '采集完成',
      total_found: uniqueRawItems.length,
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