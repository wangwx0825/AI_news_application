import { NextRequest, NextResponse } from 'next/server'
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

function inferCategory(link: string, title: string) {
  const lower = `${link} ${title}`.toLowerCase()

  if (lower.includes('/research') || lower.includes('research')) return 'Research'
  if (lower.includes('safety')) return 'Safety'
  if (lower.includes('security')) return 'Security'
  if (lower.includes('engineering')) return 'Engineering'
  if (lower.includes('global')) return 'Global Affairs'
  if (lower.includes('adoption')) return 'AI Adoption'
  if (
    lower.includes('product') ||
    lower.includes('gpt') ||
    lower.includes('chatgpt') ||
    lower.includes('codex')
  ) return 'Product'

  return 'Company'
}

type RssItem = {
  title: string
  link: string
  pubDate?: string
  description?: string
}

async function fetchOpenAIRssItems() {
  const rssUrl = 'https://openai.com/news/rss.xml'

  const response = await fetch(rssUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`OpenAI RSS 抓取失败，状态码 ${response.status}`)
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
      description: stripHtml(item?.description || item?.['content:encoded'] || ''),
    }))
    .filter((item: RssItem) => item.title && item.link)
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const rawItems = (await fetchOpenAIRssItems())
      .filter((item) => {
        const link = item.link.toLowerCase()
        return !link.includes('/business/') && !link.includes('/guides-and-resources/')
      })
      .slice(0, 80)

    const uniqueItems = Array.from(
      new Map(rawItems.map((item) => [`openai:${item.link}`, item])).values()
    )

    let inserted = 0
    let skipped = 0
    const errors: Array<{ external_id: string; message: string }> = []

    for (const rawItem of uniqueItems) {
      const summary =
        rawItem.description?.slice(0, 220).trim() ||
        `${inferCategory(rawItem.link, rawItem.title)} | 来源：OpenAI`

      const content = rawItem.description
        ? `${rawItem.description}\n\n原文链接：${rawItem.link}`
        : `${rawItem.title}\n\n原文链接：${rawItem.link}`

      const record = {
        title: rawItem.title,
        slug: slugify(rawItem.title),
        published_at: parseDate(rawItem.pubDate),
        source: 'OpenAI',
        source_url: rawItem.link,
        external_id: `openai:${rawItem.link}`,
        summary,
        content,
        status: '已发布',
        author: 'OpenAI',
        category: inferCategory(rawItem.link, rawItem.title),
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
      message: 'OpenAI 采集完成',
      total_found: uniqueItems.length,
      inserted,
      skipped,
      errors,
    })
  } catch (error) {
    console.error('OpenAI import failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}