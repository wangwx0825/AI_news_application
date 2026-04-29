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

type ContentBlock =
  | { type: 'heading'; level: 2 | 3; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'code'; language?: string; content: string }
  | { type: 'image'; src: string; alt?: string; caption?: string }
  | { type: 'table'; headers: string[]; rows: string[][] }

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

function toReaderUrl(url: string) {
  return `https://r.jina.ai/http://r.jina.ai/http://${url}`
}

function cleanMarkdownText(text: string) {
  return cleanInlineText(
    text
      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
      .replace(/\[([^\]]*)\]\([^)]+\)/g, '$1')
      .replace(/⁠?\(opens in a new window\)/g, '')
      .replace(/\*\*/g, '')
      .replace(/^_+|_+$/g, '')
      .replace(/^[-*]\s+/, '')
  )
}

function isOpenAINavigationText(text: string) {
  const normalized = text.toLowerCase()

  if (!normalized) return true
  if (normalized === '[](https://openai.com/)') return true
  if (/^(research|products|business|developers|company|openai)$/.test(normalized)) return true
  if (/^(log in|login|try chatgpt|try chatgptlogin)$/.test(normalized)) return true
  if (normalized.includes('try chatgpt')) return true
  if (normalized === 'foundation') return true
  if (normalized === 'contact sales') return true
  if (normalized === '* *') return true
  if (/^(company size|region|industry):/.test(normalized)) return true
  if (normalized === 'skip to main content') return true
  if (normalized === 'table of contents') return true
  if (/^(author|keep reading|view all|system cards)$/.test(normalized)) return true
  if (/^20\d{2}$/.test(normalized)) return true
  if (/^\w+ \d{1,2}, \d{4}$/.test(text)) return true
  if (normalized.endsWith('| openai')) return true

  return false
}

function isOpenAIFooterStart(text: string) {
  return /^(author|keep reading|community shoutouts)$/i.test(text)
}

function parseOpenAICompactTableHeader(line: string) {
  const matches = Array.from(line.matchAll(/\*\*([^*]+)\*\*/g))
    .map((match) => cleanMarkdownText(match[1]))
    .filter(Boolean)

  if (matches.length < 2) return null

  const headers: string[] = []

  for (let index = 0; index < matches.length; index += 1) {
    if (matches[index] === 'Claude' && matches[index + 1]?.startsWith('Opus')) {
      headers.push(`${matches[index]} ${matches[index + 1]}`)
      index += 1
      continue
    }

    headers.push(matches[index])
  }

  if (headers.length < 2) return null

  return headers[0].toLowerCase() === 'eval' ? headers : ['Eval', ...headers]
}

function parseOpenAICompactTableRow(
  line: string,
  valueColumnCount: number,
  labelPrefix = ''
) {
  const firstValue = line.match(/\*\*([0-9]+(?:\.[0-9]+)?%)\*\*|([0-9]+(?:\.[0-9]+)?%)/)
  const firstValueIndex = firstValue?.index

  if (firstValueIndex === undefined) return null

  const label = cleanMarkdownText(`${labelPrefix} ${line.slice(0, firstValueIndex)}`)
    .replace(/^\*+/, '')
    .trim()
  const valueText = line.slice(firstValueIndex)
  const valueMatches = Array.from(
    valueText.matchAll(/\*\*([0-9]+(?:\.[0-9]+)?%)\*\*|([0-9]+(?:\.[0-9]+)?%)|-+/g)
  )
  const values = valueMatches.flatMap((match) => {
    const token = match[1] || match[2] || match[0]

    if (/^-+$/.test(token)) {
      return token.split('').map(() => '-')
    }

    return [token]
  })

  if (!label || values.length < valueColumnCount) return null

  return [label, ...values.slice(0, valueColumnCount)]
}

function parseOpenAINumberedCode(text: string) {
  const raw = text.trim().replace(/^`|`$/g, '')

  if (!raw.startsWith('1')) return null

  let cursor = 0
  let lineNumber = 1
  const lines: string[] = []

  while (cursor < raw.length && lineNumber < 10000) {
    const marker = String(lineNumber)

    if (!raw.startsWith(marker, cursor)) return null

    cursor += marker.length

    const nextMarker = String(lineNumber + 1)
    const nextIndex = raw.indexOf(nextMarker, cursor)

    if (nextIndex === -1) {
      lines.push(raw.slice(cursor))
      break
    }

    lines.push(raw.slice(cursor, nextIndex))
    cursor = nextIndex
    lineNumber += 1
  }

  const meaningfulLines = lines.filter((line) => line.trim()).length

  if (meaningfulLines < 3) return null

  return lines.join('\n').replace(/\n+$/g, '')
}

function parseMarkdownContent(markdown: string) {
  const contentStart = markdown.indexOf('Markdown Content:')
  const body =
    contentStart >= 0
      ? markdown.slice(contentStart + 'Markdown Content:'.length)
      : markdown
  const lines = body.split(/\r?\n/).map((line) => line.trim())

  const blocks: ContentBlock[] = []
  const seenImages = new Set<string>()
  let paragraphBuffer: string[] = []
  let hasStartedArticle = false
  let pendingCodeLanguage: string | undefined

  const flushParagraph = () => {
    const text = cleanMarkdownText(paragraphBuffer.join(' '))
    paragraphBuffer = []

    if (!text) return
    if (isOpenAINavigationText(text)) return
    if (!hasStartedArticle && text.length < 80) return

    hasStartedArticle = true

    blocks.push({ type: 'paragraph', content: text })
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]

    if (!line) {
      flushParagraph()
      continue
    }

    if (/^#{4,6}\s+/.test(line)) {
      flushParagraph()
      const content = cleanMarkdownText(line.replace(/^#{4,6}\s+/, ''))

      pendingCodeLanguage = content || undefined
      continue
    }

    const numberedCode = parseOpenAINumberedCode(line)
    if (numberedCode) {
      flushParagraph()
      hasStartedArticle = true
      blocks.push({
        type: 'code',
        language: pendingCodeLanguage,
        content: numberedCode,
      })
      pendingCodeLanguage = undefined
      continue
    }

    const tableHeaders = parseOpenAICompactTableHeader(line)
    if (tableHeaders) {
      flushParagraph()

      const rows: string[][] = []
      let pendingLabel = ''
      const valueColumnCount = tableHeaders.length - 1

      for (
        let rowIndex = lineIndex + 1;
        rowIndex < lines.length;
        rowIndex += 1
      ) {
        const rowLine = lines[rowIndex]

        if (!rowLine) {
          if (pendingLabel) pendingLabel = `${pendingLabel} `
          continue
        }

        if (
          rowLine.startsWith('#') ||
          rowLine.startsWith('![') ||
          rowLine.startsWith('> ')
        ) {
          break
        }

        const row = parseOpenAICompactTableRow(
          rowLine,
          valueColumnCount,
          pendingLabel
        )

        if (row) {
          rows.push(row)
          pendingLabel = ''
          lineIndex = rowIndex
          continue
        }

        const cleanedLine = cleanMarkdownText(rowLine)
        if (rows.length && cleanedLine.length < 80 && !cleanedLine.includes('%')) {
          pendingLabel = cleanInlineText(`${pendingLabel} ${cleanedLine}`)
          lineIndex = rowIndex
          continue
        }

        break
      }

      if (hasStartedArticle && rows.length >= 2) {
        blocks.push({ type: 'table', headers: tableHeaders, rows })
      }

      continue
    }

    const imageMatch = line.match(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/)
    if (imageMatch) {
      flushParagraph()

      const alt = cleanMarkdownText(imageMatch[1].replace(/^Image \d+:\s*/i, ''))
      const src = imageMatch[2]

      if (hasStartedArticle && !seenImages.has(src)) {
        seenImages.add(src)
        blocks.push({ type: 'image', src, alt })
      }

      continue
    }

    if (line.startsWith('### ')) {
      flushParagraph()
      const content = cleanMarkdownText(line.replace(/^###\s+/, ''))
      if (hasStartedArticle && isOpenAIFooterStart(content)) break
      if (hasStartedArticle && content && !isOpenAINavigationText(content)) {
        blocks.push({ type: 'heading', level: 3, content })
      }
      continue
    }

    if (line.startsWith('## ')) {
      flushParagraph()
      const content = cleanMarkdownText(line.replace(/^##\s+/, ''))
      if (hasStartedArticle && isOpenAIFooterStart(content)) break
      if (hasStartedArticle && content && !isOpenAINavigationText(content)) {
        blocks.push({ type: 'heading', level: 2, content })
      }
      continue
    }

    if (line.startsWith('# ')) {
      flushParagraph()
      continue
    }

    if (line.startsWith('> ')) {
      flushParagraph()
      const content = cleanMarkdownText(line.replace(/^>\s+/, ''))
      if (content && content.length >= 40) {
        hasStartedArticle = true
        blocks.push({ type: 'quote', content })
      }
      continue
    }

    if (line.startsWith('*   ') || line.startsWith('- ')) {
      flushParagraph()
      const content = cleanMarkdownText(line.replace(/^(\*   |- )/, ''))
      if (isOpenAINavigationText(content)) continue
      if (!hasStartedArticle && content.length < 80) continue
      if (content) {
        hasStartedArticle = true
        blocks.push({ type: 'paragraph', content })
      }
      continue
    }

    if (line.startsWith('—')) {
      const content = cleanMarkdownText(line)
      if (content) blocks.push({ type: 'paragraph', content })
      continue
    }

    paragraphBuffer.push(line)
  }

  flushParagraph()

  return blocks
}

function blocksToPlainText(blocks: ContentBlock[]) {
  return blocks
    .flatMap((block) => {
      if (block.type === 'paragraph' || block.type === 'quote') return [block.content]
      if (block.type === 'code') return [block.content]
      if (block.type === 'table') {
        return [
          [block.headers.join('\t'), ...block.rows.map((row) => row.join('\t'))].join('\n'),
        ]
      }
      return []
    })
    .join('\n\n')
    .trim()
}

async function fetchOpenAIDetail(fullUrl: string) {
  try {
    const response = await fetch(toReaderUrl(fullUrl), {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      cache: 'no-store',
    })

    if (!response.ok) {
      return {
        content: '',
        content_blocks: [] as ContentBlock[],
        cover_image: null as string | null,
      }
    }

    const markdown = await response.text()
    const contentBlocks = parseMarkdownContent(markdown)
    const firstImage = contentBlocks.find((block) => block.type === 'image')

    return {
      content: blocksToPlainText(contentBlocks),
      content_blocks: contentBlocks,
      cover_image: firstImage?.src || null,
    }
  } catch {
    return {
      content: '',
      content_blocks: [] as ContentBlock[],
      cover_image: null as string | null,
    }
  }
}

type RssItem = {
  title: string
  link: string
  pubDate?: string
  description?: string
  category?: string
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
      category: cleanInlineText(item?.category || ''),
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
      const detail = await fetchOpenAIDetail(rawItem.link)
      const summary =
        rawItem.description?.slice(0, 220).trim() ||
        `${inferCategory(rawItem.link, rawItem.title)} | 来源：OpenAI`

      const fallbackContent = rawItem.description
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
        content: detail.content || fallbackContent,
        content_blocks: detail.content_blocks,
        status: '已发布',
        author: 'OpenAI',
        cover_image: detail.cover_image,
        category: rawItem.category || inferCategory(rawItem.link, rawItem.title),
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
