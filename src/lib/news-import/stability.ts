import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import { cleanInlineText, toAbsoluteUrl } from './common'

export type StabilityContentBlock =
  | { type: 'heading'; level: 2 | 3; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'image'; src: string; alt?: string; caption?: string }
  | { type: 'video'; src: string; poster?: string; caption?: string }

export function cleanStabilityTitle(text: string, source: 'Google DeepMind' | 'Stability AI') {
  const cleaned = cleanInlineText(text)

  if (!cleaned) return cleaned

  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return cleaned
    .replace(new RegExp(`\\s*[—–-]{1,2}\\s*${escapedSource}\\s*$`, 'i'), '')
    .replace(new RegExp(`\\s*\\|\\s*${escapedSource}\\s*$`, 'i'), '')
    .trim()
}

export function parseStabilityDate(dateText: string | undefined) {
  if (!dateText) return null
  const normalized = dateText.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
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

export function extractStabilityContentBlocks($: cheerio.CheerioAPI, fullUrl: string) {
  const $container = pickContentContainer($)
  if (!$container) return []

  const blocks: StabilityContentBlock[] = []
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

function blocksToPlainText(blocks: StabilityContentBlock[]) {
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

function removeDuplicateMedia(blocks: StabilityContentBlock[], coverImage: string | null) {
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

function extractDetailDate($: cheerio.CheerioAPI) {
  const candidates = [
    $('meta[property="article:published_time"]').attr('content'),
    $('meta[name="article:published_time"]').attr('content'),
    $('meta[itemprop="datePublished"]').attr('content'),
    $('meta[name="datePublished"]').attr('content'),
    $('time').first().attr('datetime'),
    cleanInlineText($('time').first().text()),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const parsed = parseStabilityDate(candidate)
    if (parsed) return parsed
  }

  const bodyText = cleanInlineText($('body').text())
  const match = bodyText.match(
    /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/
  )

  if (match) {
    return parseStabilityDate(match[0])
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
  const byMatch = bodyText.match(
    /Written By\s+([A-Z][A-Za-z\s,&.'-]{2,100})|By\s+([A-Z][A-Za-z\s,&.'-]{2,100})/
  )
  if (byMatch?.[1]) return cleanInlineText(byMatch[1])
  if (byMatch?.[2]) return cleanInlineText(byMatch[2])

  return 'Stability AI'
}

export function inferStabilityCategory(text: string) {
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

export async function fetchStabilityDetail(fullUrl: string) {
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

    const pageTitle = cleanStabilityTitle(
      cleanInlineText($('title').text()),
      'Stability AI'
    )

    const coverImage = extractCoverImage($, fullUrl)
    const publishedAt = extractDetailDate($)
    const author = extractAuthor($)
    const contentBlocks = removeDuplicateMedia(
      extractStabilityContentBlocks($, fullUrl),
      coverImage
    )

    return {
      title: pageTitle || null,
      cover_image: coverImage,
      published_at: publishedAt,
      author: author || 'Stability AI',
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

export async function fetchStabilityListItems() {
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
    if (
      fullUrl === 'https://stability.ai/news-updates/' ||
      fullUrl === 'https://stability.ai/news-updates'
    ) return
    if (fullUrl.includes('/category/')) return

    const text = cleanInlineText($(el).text())
    if (!text || text.length < 12) return
    if (/read more|older posts|learn more|submit a support request/i.test(text)) return

    items.push({
      title: text,
      href: fullUrl,
      category: inferStabilityCategory(text),
    })
  })

  return Array.from(
    new Map(items.map((item) => [`stability:${item.href}`, item])).values()
  ).slice(0, 50)
}
