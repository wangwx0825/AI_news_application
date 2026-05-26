import { XMLParser } from 'fast-xml-parser'
import { cleanInlineText, stripHtml } from './common'

export type OpenAIContentBlock =
  | { type: 'heading'; level: 2 | 3; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'code'; language?: string; content: string }
  | { type: 'image'; src: string; alt?: string; caption?: string }
  | { type: 'table'; headers: string[]; rows: string[][] }

export type OpenAIRssItem = {
  title: string
  link: string
  pubDate?: string
  description?: string
  category?: string
}

type RawOpenAIRssItem = {
  title?: string
  link?: string
  pubDate?: string
  published?: string
  date?: string
  description?: string
  'content:encoded'?: string
  category?: string
}

export function parseOpenAIDate(dateText: string | undefined) {
  if (!dateText) return null
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export function inferOpenAICategory(link: string, title: string) {
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

export function toOpenAIReaderUrl(url: string) {
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

export function parseOpenAIMarkdownContent(markdown: string) {
  const contentStart = markdown.indexOf('Markdown Content:')
  const body =
    contentStart >= 0
      ? markdown.slice(contentStart + 'Markdown Content:'.length)
      : markdown
  const lines = body.split(/\r?\n/).map((line) => line.trim())

  const blocks: OpenAIContentBlock[] = []
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

export function openAIBlocksToPlainText(blocks: OpenAIContentBlock[]) {
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

export async function fetchOpenAIDetail(fullUrl: string) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      if (attempt > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt))
      }

      const response = await fetch(toOpenAIReaderUrl(fullUrl), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        cache: 'no-store',
      })

      if (!response.ok) {
        continue
      }

      const markdown = await response.text()
      const contentBlocks = parseOpenAIMarkdownContent(markdown)

      if (!contentBlocks.length) {
        continue
      }

      const firstImage = contentBlocks.find((block) => block.type === 'image')

      return {
        content: openAIBlocksToPlainText(contentBlocks),
        content_blocks: contentBlocks,
        cover_image: firstImage?.src || null,
      }
    } catch {
      if (attempt === 2) {
        break
      }
    }
  }

  return {
    content: '',
    content_blocks: [] as OpenAIContentBlock[],
    cover_image: null as string | null,
  }
}

export async function fetchOpenAIRssItems() {
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
    .map((item: RawOpenAIRssItem) => ({
      title: cleanInlineText(item.title || ''),
      link: item.link || '',
      pubDate: item.pubDate || item.published || item.date || '',
      description: stripHtml(item.description || item['content:encoded'] || ''),
      category: cleanInlineText(item.category || ''),
    }))
    .filter((item: OpenAIRssItem) => item.title && item.link)
}
