import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ContentBlock =
  | { type: 'heading'; level: 2 | 3; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'image'; src: string; alt?: string; caption?: string }
  | { type: 'audio'; src: string }
  | { type: 'video'; src: string; poster?: string; caption?: string }

type DeepMindDetailResult = {
  title: string | null
  content: string
  content_blocks: ContentBlock[]
  cover_image: string | null
  published_at: string | null
  author: string | null
}

const supabaseSafeText = (text: string) => text.replace(/\u0000/g, '')

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

function cleanParagraph(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
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

function isLikelyBadSummary(text: string) {
  const cleaned = cleanInlineText(text)
  if (!cleaned) return true
  if (cleaned.length < 30) return true

  const lower = cleaned.toLowerCase()

  if (
    lower.includes('your browser does not support the audio element') ||
    lower.includes('your browser does not support the video tag') ||
    lower.includes('your browser does not support the video element')
  ) {
    return true
  }

  if (
    /^by\s+/i.test(cleaned) ||
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(cleaned)
  ) {
    return true
  }

  // 过滤掉很像作者名的短句
  if (
    cleaned.length < 80 &&
    /^[A-Z][A-Za-z.'-]+(?:\s+(?:and|&)\s+|\s+)[A-Z][A-Za-z.'-]+/.test(cleaned) &&
    !/[.!?]/.test(cleaned)
  ) {
    return true
  }

  return false
}

function buildSummaryFromBlocks(blocks: ContentBlock[], fallbackCategory: string) {
  for (const block of blocks) {
    if (block.type !== 'paragraph') continue

    const text = cleanInlineText(block.content)
    if (isLikelyBadSummary(text)) continue

    return text.slice(0, 220).trim()
  }

  return `${fallbackCategory} | 来源：Google DeepMind`
}

function blocksToPlainText(blocks: ContentBlock[]) {
  return blocks
    .filter((block) => block.type === 'paragraph')
    .map((block) => block.content)
    .join('\n\n')
    .trim()
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

function inferCategory(text: string) {
  const lower = text.toLowerCase()

  if (lower.includes('models')) return 'Models'
  if (lower.includes('research')) return 'Research'
  if (lower.includes('science')) return 'Science'
  if (lower.includes('responsibility') || lower.includes('safety')) return 'Safety'
  if (lower.includes('robot')) return 'Robotics'
  return 'Google DeepMind'
}

function extractDetailDate($: cheerio.CheerioAPI) {
  const candidates = [
    $('meta[property="article:published_time"]').attr('content'),
    $('meta[name="article:published_time"]').attr('content'),
    $('meta[property="og:updated_time"]').attr('content'),
    $('time').first().attr('datetime'),
    cleanInlineText($('time').first().text()),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const parsed = parseDate(candidate)
    if (parsed) return parsed
  }

  const bodyText = cleanInlineText($('body').text())
  const match = bodyText.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/
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

function getImageSrc($img: cheerio.Cheerio<any>, fullUrl: string) {
  const src =
    $img.attr('src') ||
    $img.attr('data-src') ||
    $img.attr('data-original')

  if (src) {
    return toAbsoluteUrl(src, fullUrl)
  }

  const srcset =
    $img.attr('srcset') ||
    $img.attr('data-srcset')

  if (srcset) {
    const firstSrc = srcset
      .split(',')
      .map((item) => item.trim().split(' ')[0])
      .find(Boolean)

    if (firstSrc) {
      return toAbsoluteUrl(firstSrc, fullUrl)
    }
  }

  return null
}

function getMediaSrc($el: cheerio.Cheerio<any>, fullUrl: string) {
  const directSrc =
    $el.attr('src') ||
    $el.attr('data-src') ||
    $el.attr('data-original')

  if (directSrc) {
    return toAbsoluteUrl(directSrc, fullUrl)
  }

  const sourceSrc =
    $el.find('source').first().attr('src') ||
    $el.find('source').first().attr('data-src')

  if (sourceSrc) {
    return toAbsoluteUrl(sourceSrc, fullUrl)
  }

  return null
}

function getVideoPoster($el: cheerio.Cheerio<any>, fullUrl: string) {
  const poster = $el.attr('poster')
  if (!poster) return null
  return toAbsoluteUrl(poster, fullUrl)
}

function extractParagraphs($: cheerio.CheerioAPI) {
  const selectors = ['article p', 'main p', '[role="main"] p']

  for (const selector of selectors) {
    const paragraphs = $(selector)
      .map((_, el) => cleanParagraph($(el).text()))
      .get()
      .filter((text) => {
        if (!text) return false

        return (
          !text.includes('Your browser does not support the audio element.') &&
          !text.includes('Your browser does not support the video tag.') &&
          !text.includes('Your browser does not support the video element.')
        )
      })

    if (paragraphs.length >= 3) {
      return paragraphs
    }
  }

  return []
}

function extractContentBlocks($: cheerio.CheerioAPI, fullUrl: string): ContentBlock[] {
  const blocks: ContentBlock[] = []
  const seenImages = new Set<string>()
  const seenMedia = new Set<string>()

  const containerSelectors = ['article', 'main', '[role="main"]']

  let $container: cheerio.Cheerio<any> | null = null

  for (const selector of containerSelectors) {
    const candidate = $(selector).first()
    if (candidate.length) {
      $container = candidate
      break
    }
  }

  if (!$container) return blocks

  const $elements = $container.find(
    'h2, h3, p, figure, img, picture, audio, video, blockquote'
  )

  $elements.each((_, el) => {
    const $el = $(el)
    const tagName = el.tagName?.toLowerCase()

    if (tagName === 'h2' || tagName === 'h3') {
      const text = cleanInlineText($el.text())
      if (text) {
        blocks.push({
          type: 'heading',
          level: tagName === 'h2' ? 2 : 3,
          content: supabaseSafeText(text),
        })
      }
      return
    }

    if (tagName === 'p') {
      const text = cleanParagraph($el.text())

      if (
        text &&
        !text.includes('Your browser does not support the audio element.') &&
        !text.includes('Your browser does not support the video tag.') &&
        !text.includes('Your browser does not support the video element.')
      ) {
        blocks.push({
          type: 'paragraph',
          content: supabaseSafeText(text),
        })
      }
      return
    }

    if (tagName === 'blockquote') {
      const text = cleanParagraph($el.text())
      if (text) {
        blocks.push({
          type: 'quote',
          content: supabaseSafeText(text),
        })
      }
      return
    }

    if (tagName === 'figure') {
      const $img = $el.find('img').first()
      const src = getImageSrc($img, fullUrl)
      const alt = cleanInlineText($img.attr('alt') || '')
      const caption = cleanInlineText($el.find('figcaption').text())

      if (src && !seenImages.has(src)) {
        seenImages.add(src)
        blocks.push({
          type: 'image',
          src,
          alt: alt || undefined,
          caption: caption || undefined,
        })
      }

      const $audio = $el.find('audio').first()
      const audioSrc = getMediaSrc($audio, fullUrl)
      if (audioSrc && !seenMedia.has(audioSrc)) {
        seenMedia.add(audioSrc)
        blocks.push({
          type: 'audio',
          src: audioSrc,
        })
      }

      const $video = $el.find('video').first()
      const videoSrc = getMediaSrc($video, fullUrl)
      const poster = getVideoPoster($video, fullUrl)
      const captionText = cleanInlineText($el.find('figcaption').text())

      if (videoSrc && !seenMedia.has(videoSrc)) {
        seenMedia.add(videoSrc)
        blocks.push({
          type: 'video',
          src: videoSrc,
          poster: poster || undefined,
          caption: captionText || undefined,
        })
      }

      return
    }

    if (tagName === 'picture') {
      const $img = $el.find('img').first()
      const src = getImageSrc($img, fullUrl)
      const alt = cleanInlineText($img.attr('alt') || '')

      if (src && !seenImages.has(src)) {
        seenImages.add(src)
        blocks.push({
          type: 'image',
          src,
          alt: alt || undefined,
        })
      }
      return
    }

    if (tagName === 'img') {
      const src = getImageSrc($el, fullUrl)
      const alt = cleanInlineText($el.attr('alt') || '')

      if (src && !seenImages.has(src)) {
        seenImages.add(src)
        blocks.push({
          type: 'image',
          src,
          alt: alt || undefined,
        })
      }
      return
    }

    if (tagName === 'audio') {
      const src = getMediaSrc($el, fullUrl)
      if (src && !seenMedia.has(src)) {
        seenMedia.add(src)
        blocks.push({
          type: 'audio',
          src,
        })
      }
      return
    }

    if (tagName === 'video') {
      const src = getMediaSrc($el, fullUrl)
      const poster = getVideoPoster($el, fullUrl)

      if (src && !seenMedia.has(src)) {
        seenMedia.add(src)
        blocks.push({
          type: 'video',
          src,
          poster: poster || undefined,
        })
      }
    }
  })

  return blocks
}

async function fetchDeepMindDetail(fullUrl: string): Promise<DeepMindDetailResult> {
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
        content_blocks: [],
        cover_image: null,
        published_at: null,
        author: null,
      }
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const pageTitle = cleanInlineText($('title').text())
      .replace(/\s*\|\s*Google DeepMind\s*$/i, '')
      .replace(/\s*\\\s*Google DeepMind\s*$/i, '')
      .replace(/\s*\|\s*Google Blog\s*$/i, '')
      .replace(/\s*\\\s*Google Blog\s*$/i, '')

    const coverImage = extractCoverImage($, fullUrl)
    const publishedAt = extractDetailDate($)
    const author = extractAuthor($)
    const contentBlocks = extractContentBlocks($, fullUrl)
    let content = blocksToPlainText(contentBlocks)

    const hasParagraphBlocks = contentBlocks.some(
      (block) => block.type === 'paragraph'
    )

    if (!hasParagraphBlocks) {
      const fallbackParagraphs = extractParagraphs($)

      if (fallbackParagraphs.length > 0) {
        const fallbackBlocks: ContentBlock[] = fallbackParagraphs.map((text) => ({
          type: 'paragraph',
          content: supabaseSafeText(text),
        }))

        contentBlocks.push(...fallbackBlocks)
        content = fallbackParagraphs.join('\n\n')
      }
    }

    return {
      title: pageTitle || null,
      content: supabaseSafeText(content),
      content_blocks: contentBlocks,
      cover_image: coverImage,
      published_at: publishedAt,
      author,
    }
  } catch {
    return {
      title: null,
      content: '',
      content_blocks: [],
      cover_image: null,
      published_at: null,
      author: null,
    }
  }
}

type RawDeepMindItem = {
  title: string
  link: string
  category: string
}

async function fetchDeepMindListItems() {
  const listUrl = 'https://deepmind.google/blog/'

  async function fetchOnce() {
    const response = await fetch(listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`DeepMind 列表页抓取失败，状态码 ${response.status}`)
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const titles = $('h3')
      .map((_, el) => cleanInlineText($(el).text()))
      .get()
      .filter(Boolean)

    const links = $('a')
      .map((_, el) => {
        const text = cleanInlineText($(el).text())
        const href = $(el).attr('href')

        if (!text.toLowerCase().includes('learn more')) return null

        const fullUrl = toAbsoluteUrl(href, listUrl)
        if (!fullUrl) return null

        return fullUrl
      })
      .get()
      .filter(Boolean) as string[]

    const count = Math.min(titles.length, links.length)
    const items: RawDeepMindItem[] = []

    for (let i = 0; i < count; i++) {
      const title = titles[i]
      const link = links[i]

      if (!title || !link) continue

      items.push({
        title,
        link,
        category: inferCategory(title),
      })
    }

    return Array.from(
      new Map(items.map((item) => [`deepmind:${item.link}`, item])).values()
    ).slice(0, 40)
  }

  try {
    return await fetchOnce()
  } catch (error) {
    console.warn('DeepMind 第一次抓取失败，准备重试一次...', error)

    await new Promise((resolve) => setTimeout(resolve, 1500))

    return await fetchOnce()
  }
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
    const rawItems = await fetchDeepMindListItems()

    let inserted = 0
    let skipped = 0
    const errors: Array<{ external_id: string; message: string }> = []

    for (const rawItem of rawItems) {
      const detail = await fetchDeepMindDetail(rawItem.link)

      const finalTitle = detail.title || rawItem.title
      const finalBlocks = detail.content_blocks || []
      const finalContent =
        detail.content || `${finalTitle}\n\n原文链接：${rawItem.link}`

      const record = {
        title: finalTitle,
        slug: slugify(finalTitle),
        published_at: detail.published_at,
        source: 'Google DeepMind',
        source_url: rawItem.link,
        external_id: `deepmind:${rawItem.link}`,
        summary: buildSummaryFromBlocks(finalBlocks, rawItem.category),
        content: finalContent,
        content_blocks: finalBlocks,
        status: '已发布',
        author: detail.author || 'Google DeepMind',
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
      message: 'Google DeepMind 采集完成',
      total_found: rawItems.length,
      inserted,
      skipped,
      errors,
    })
  } catch (error) {
    console.error('DeepMind import failed:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    )
  }
}

