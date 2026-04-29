import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { createClient } from '@supabase/supabase-js'
import { XMLParser } from 'fast-xml-parser'
import type { AnyNode } from 'domhandler'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type ContentBlock =
  | { type: 'heading'; level: 2 | 3; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'image'; src: string; alt?: string; caption?: string }
  | { type: 'video'; src: string; poster?: string; caption?: string }

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

function pickLargestFromSrcset(srcset: string | undefined) {
  if (!srcset) return null

  const candidates = srcset
    .split(',')
    .map((candidate) => {
      const [url, size] = candidate.trim().split(/\s+/)
      const width = Number.parseInt(size?.replace('w', '') || '0', 10)
      return { url, width: Number.isNaN(width) ? 0 : width }
    })
    .filter((candidate) => candidate.url)
    .sort((a, b) => b.width - a.width)

  return candidates[0]?.url || null
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

function getImageSrc($el: cheerio.Cheerio<AnyNode>, fullUrl: string) {
  const $img = $el.is('img') ? $el : $el.find('img').first()
  const sourceSrcset =
    $el.is('picture')
      ? $el.find('source').last().attr('srcset') ||
        $el.find('source').last().attr('data-srcset')
      : undefined
  const src =
    pickLargestFromSrcset(sourceSrcset) ||
    pickLargestFromSrcset($img.attr('srcset')) ||
    pickLargestFromSrcset($img.attr('data-srcset')) ||
    $img.attr('src') ||
    $img.attr('data-src') ||
    $img.attr('data-original')

  return toAbsoluteUrl(src, fullUrl)
}

function getMediaSrc($el: cheerio.Cheerio<AnyNode>, fullUrl: string) {
  const src =
    $el.attr('src') ||
    $el.attr('data-src') ||
    $el.find('source').first().attr('src') ||
    $el.find('source').first().attr('data-src')

  return toAbsoluteUrl(src, fullUrl)
}

function getVideoPoster($el: cheerio.Cheerio<AnyNode>, fullUrl: string) {
  const poster = $el.attr('poster')
  if (!poster) return null
  return toAbsoluteUrl(poster, fullUrl)
}

function isLikelyContentImage(src: string, alt: string, caption = '') {
  const lower = `${src} ${alt} ${caption}`.toLowerCase()

  if (lower.endsWith('.svg')) return false
  if (lower.includes('/icons/') || lower.includes('/icon/')) return false
  if (lower.includes('logo')) return false
  if (lower.includes('avatar')) return false
  if (lower.includes('tracking')) return false
  if (lower.includes('placeholder')) return false
  if (lower.includes('transparent')) return false
  if (lower.includes('spacer')) return false
  if (lower.includes('blur')) return false
  if (lower.includes('newsletter')) return false
  if (lower.includes('subscribe')) return false

  return true
}

function isNonArticleMediaContext($el: cheerio.Cheerio<AnyNode>) {
  return Boolean(
    $el.closest(
      [
        'header',
        'footer',
        'nav',
        'aside',
        '[class*="carousel"]',
        '[class*="slider"]',
        '[class*="swiper"]',
        '[class*="newsletter"]',
        '[class*="subscribe"]',
        '[class*="footer"]',
        '[class*="header"]',
        '[class*="nav"]',
        '[class*="share"]',
        '[class*="social"]',
        '[class*="logo"]',
      ].join(',')
    ).length
  )
}

function pickContentContainer(
  $: cheerio.CheerioAPI
): cheerio.Cheerio<AnyNode> | null {
  const selectors = ['article', 'main article', 'main', '[role="main"]', '.prose']
  let bestContainer: cheerio.Cheerio<AnyNode> | null = null
  let bestScore = 0

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const candidate = $(el)
      const paragraphCount = candidate
        .find('p')
        .map((__, paragraph) => cleanInlineText($(paragraph).text()))
        .get()
        .filter((text) => text.length > 40).length
      const mediaCount = candidate.find('figure, picture, img, video').length
      const headingCount = candidate.find('h2, h3').length
      const score = paragraphCount * 3 + mediaCount + headingCount

      if (score > bestScore) {
        bestScore = score
        bestContainer = candidate as cheerio.Cheerio<AnyNode>
      }
    })
  }

  return bestContainer
}

function extractContentBlocks($: cheerio.CheerioAPI, fullUrl: string) {
  const $container = pickContentContainer($)
  if (!$container) return []

  const blocks: ContentBlock[] = []
  const seenImages = new Set<string>()
  const seenMedia = new Set<string>()

  $container
    .find('h2, h3, p, blockquote, figure, picture, img, video')
    .each((_, el) => {
      const $el = $(el)
      const tagName = el.tagName?.toLowerCase()

      if (
        tagName !== 'figure' &&
        ($el.closest('figcaption').length || $el.closest('figure').length)
      ) {
        return
      }

      if (tagName === 'h2' || tagName === 'h3') {
        const text = cleanInlineText($el.text())
        if (text) {
          blocks.push({
            type: 'heading',
            level: tagName === 'h3' ? 3 : 2,
            content: text,
          })
        }
        return
      }

      if (tagName === 'p') {
        const text = cleanInlineText($el.text())
        if (
          text &&
          !text.includes('Your browser does not support the video tag.') &&
          !text.includes('Your browser does not support the video element.')
        ) {
          blocks.push({ type: 'paragraph', content: text })
        }
        return
      }

      if (tagName === 'blockquote') {
        const text = cleanInlineText($el.text())
        if (text) blocks.push({ type: 'quote', content: text })
        return
      }

      if (tagName === 'figure') {
        if (isNonArticleMediaContext($el)) return

        const src = getImageSrc($el, fullUrl)
        const alt = cleanInlineText($el.find('img').first().attr('alt') || '')
        const caption = cleanInlineText($el.find('figcaption').first().text())

        if (
          src &&
          !seenImages.has(src) &&
          isLikelyContentImage(src, alt, caption)
        ) {
          seenImages.add(src)
          blocks.push({ type: 'image', src, alt, caption })
        }

        const $video = $el.find('video').first()
        const videoSrc = getMediaSrc($video, fullUrl)
        const poster = getVideoPoster($video, fullUrl)

        if (videoSrc && !seenMedia.has(videoSrc)) {
          seenMedia.add(videoSrc)
          blocks.push({
            type: 'video',
            src: videoSrc,
            poster: poster || undefined,
            caption: caption || undefined,
          })
        }

        return
      }

      if (tagName === 'picture' || tagName === 'img') {
        if ($el.closest('figure').length) return
        if (isNonArticleMediaContext($el)) return

        const src = getImageSrc($el, fullUrl)
        const alt = cleanInlineText(
          tagName === 'picture'
            ? $el.find('img').first().attr('alt') || ''
            : $el.attr('alt') || ''
        )

        if (!alt) return

        if (src && !seenImages.has(src) && isLikelyContentImage(src, alt)) {
          seenImages.add(src)
          blocks.push({ type: 'image', src, alt })
        }

        return
      }

      if (tagName === 'video') {
        const src = getMediaSrc($el, fullUrl)
        const poster = getVideoPoster($el, fullUrl)

        if (src && !seenMedia.has(src)) {
          seenMedia.add(src)
          blocks.push({ type: 'video', src, poster: poster || undefined })
        }
      }
    })

  return blocks
}

function blocksToPlainText(blocks: ContentBlock[]) {
  return blocks
    .filter((block) => block.type === 'paragraph')
    .map((block) => block.content)
    .join('\n\n')
    .trim()
}

function imageKey(src: string) {
  try {
    const url = new URL(src)
    url.search = ''
    const filename = url.pathname.split('/').filter(Boolean).pop()

    if (filename) return filename.toLowerCase()

    return url.toString().toLowerCase()
  } catch {
    return src.toLowerCase()
  }
}

function removeDuplicateMedia(blocks: ContentBlock[], coverImage: string | null) {
  const seenImages = new Set<string>()
  const seenVideos = new Set<string>()
  const coverKey = coverImage ? imageKey(coverImage) : null
  let hasStartedBodyText = false

  return blocks.filter((block) => {
    if (block.type !== 'image' && block.type !== 'video') {
      if (
        (block.type === 'paragraph' ||
          block.type === 'heading' ||
          block.type === 'quote') &&
        block.content.trim()
      ) {
        hasStartedBodyText = true
      }

      return true
    }

    if (block.type === 'video') {
      const key = imageKey(block.src)
      if (!hasStartedBodyText) return false
      if (seenVideos.has(key)) return false
      seenVideos.add(key)
      return true
    }

    const key = imageKey(block.src)
    if (!hasStartedBodyText) return false
    if (coverKey && key === coverKey) return false
    if (seenImages.has(key)) return false

    seenImages.add(key)
    return true
  })
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
        content: '',
        content_blocks: [],
      }
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    const pageTitle = cleanInlineText($('title').text())
      .replace(/\s*\|\s*Hugging Face\s*$/i, '')

    const coverImage = extractCoverImage($, fullUrl)
    const contentBlocks = removeDuplicateMedia(
      extractContentBlocks($, fullUrl),
      coverImage
    )

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
      content: blocksToPlainText(contentBlocks),
      content_blocks: contentBlocks,
    }
  } catch {
    return {
      title: null,
      cover_image: null,
      published_at: null,
      author: null,
      content: '',
      content_blocks: [],
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
        content: detail.content,
        content_blocks: detail.content_blocks,
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
