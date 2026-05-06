import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import { cleanInlineText, toAbsoluteUrl } from './common'

export type AnthropicDetailResult = {
  title: string | null
  content: string
  content_blocks: AnthropicContentBlock[]
  cover_image: string | null
  author: string | null
}

export type AnthropicContentBlock =
  | { type: 'heading'; level: 2 | 3; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'image'; src: string; alt?: string; caption?: string }
  | { type: 'video'; src: string; poster?: string; caption?: string }

export function parseAnthropicDate(dateText: string) {
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
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

export function buildAnthropicSummary(content: string, fallbackCategory: string) {
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

function upgradeImageUrl(src: string | null) {
  if (!src) return null

  try {
    const url = new URL(src)

    if (
      url.hostname.includes('googleusercontent.com') ||
      url.hostname.includes('ggpht.com')
    ) {
      url.pathname = url.pathname.replace(/=s\d+(?:-[^/?#]+)?$/i, '=s1600')
      url.pathname = url.pathname.replace(/=w\d+(?:-[^/?#]+)?$/i, '=w1600')
    }

    return url.toString()
  } catch {
    return src
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

function isLikelyPlaceholderImage(src: string) {
  const lower = src.toLowerCase()

  return (
    lower.startsWith('data:image') ||
    lower.includes('placeholder') ||
    lower.includes('transparent') ||
    lower.includes('spacer') ||
    lower.includes('blur') ||
    lower.includes('1x1')
  )
}

function getImageSrc($img: cheerio.Cheerio<AnyNode>, fullUrl: string) {
  const src =
    pickLargestFromSrcset($img.attr('srcset')) ||
    pickLargestFromSrcset($img.attr('data-srcset')) ||
    $img.attr('src') ||
    $img.attr('data-src') ||
    $img.attr('data-original')

  if (src && isLikelyPlaceholderImage(src)) return null

  return upgradeImageUrl(toAbsoluteUrl(src, fullUrl))
}

function getPictureSrc($picture: cheerio.Cheerio<AnyNode>, fullUrl: string) {
  const sourceSrcset =
    $picture.find('source').last().attr('srcset') ||
    $picture.find('source').last().attr('data-srcset')
  const sourceSrc = pickLargestFromSrcset(sourceSrcset)

  if (sourceSrc && !isLikelyPlaceholderImage(sourceSrc)) {
    return upgradeImageUrl(toAbsoluteUrl(sourceSrc, fullUrl))
  }

  return getImageSrc($picture.find('img').first(), fullUrl)
}

function getMediaSrc($el: cheerio.Cheerio<AnyNode>, fullUrl: string) {
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

function getVideoPoster($el: cheerio.Cheerio<AnyNode>, fullUrl: string) {
  const poster = $el.attr('poster')
  if (!poster) return null
  return toAbsoluteUrl(poster, fullUrl)
}

function isLikelyContentImage(src: string, alt: string) {
  const lower = `${src} ${alt}`.toLowerCase()

  if (lower.endsWith('.svg')) return false
  if (lower.includes('/icons/') || lower.includes('/icon/')) return false
  if (lower.includes('logo')) return false
  if (lower.includes('avatar')) return false
  if (lower.includes('icon')) return false
  if (lower.includes('tracking')) return false
  if (lower.includes('placeholder')) return false
  if (lower.includes('transparent')) return false
  if (lower.includes('spacer')) return false
  if (lower.includes('blur')) return false
  if (lower.includes('newsletter')) return false
  if (lower.includes('subscribe')) return false
  if (lower.includes('inbox')) return false
  if (lower.includes('google_g')) return false
  if (lower.includes('google-g')) return false
  if (lower.includes('google-logo')) return false

  return true
}

function isNonArticleImageContext($el: cheerio.Cheerio<AnyNode>) {
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
        '[class*="glide"]',
        '[class*="slick"]',
        '[class*="slideshow"]',
        '[class*="newsletter"]',
        '[class*="subscribe"]',
        '[class*="signup"]',
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
  const selectors = ['article', 'main', '[role="main"]', '.prose']
  let bestContainer: cheerio.Cheerio<AnyNode> | null = null
  let bestScore = 0

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const candidate = $(el)
      const paragraphCount = candidate
        .find('p')
        .map((__, paragraph) => cleanParagraph($(paragraph).text()))
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

export function extractAnthropicContentBlocks($: cheerio.CheerioAPI, fullUrl: string) {
  const $container = pickContentContainer($)
  if (!$container) return []

  const blocks: AnthropicContentBlock[] = []
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

      if (tagName === 'figure') {
        if (isNonArticleImageContext($el)) return

        const $img = $el.find('img').first()
        const src = getImageSrc($img, fullUrl)
        const alt = cleanInlineText($img.attr('alt') || '')
        const caption = cleanInlineText($el.find('figcaption').first().text())

        if (src && !seenImages.has(src) && isLikelyContentImage(src, alt)) {
          seenImages.add(src)
          blocks.push({ type: 'image', src, alt, caption })
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
        if (isNonArticleImageContext($el)) return

        const src = getPictureSrc($el, fullUrl)
        const alt = cleanInlineText($el.find('img').first().attr('alt') || '')

        if (!alt) return

        if (src && !seenImages.has(src) && isLikelyContentImage(src, alt)) {
          seenImages.add(src)
          blocks.push({ type: 'image', src, alt })
        }

        return
      }

      if (tagName === 'img') {
        if ($el.closest('figure').length) return
        if (isNonArticleImageContext($el)) return

        const src = getImageSrc($el, fullUrl)
        const alt = cleanInlineText($el.attr('alt') || '')

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
          blocks.push({
            type: 'video',
            src,
            poster: poster || undefined,
          })
        }

        return
      }

      const text = cleanParagraph($el.text())
      if (!text) return

      if (tagName === 'h2' || tagName === 'h3') {
        blocks.push({
          type: 'heading',
          level: tagName === 'h3' ? 3 : 2,
          content: text,
        })
        return
      }

      if (tagName === 'blockquote') {
        blocks.push({ type: 'quote', content: text })
        return
      }

      blocks.push({ type: 'paragraph', content: text })
    })

  return blocks
}

function blocksToPlainText(blocks: AnthropicContentBlock[]) {
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

    if (filename) {
      return filename.toLowerCase()
    }

    return url.toString().toLowerCase()
  } catch {
    return src.toLowerCase()
  }
}

function removeDuplicateImages(
  blocks: AnthropicContentBlock[],
  coverImage: string | null
) {
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

export async function fetchAnthropicDetail(fullUrl: string): Promise<AnthropicDetailResult> {
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
    const contentBlocks = removeDuplicateImages(
      extractAnthropicContentBlocks($, fullUrl),
      coverImage
    )
    const paragraphs = extractParagraphs($)
    const author = extractAuthor($)

    if (contentBlocks.length > 0) {
      return {
        title: pageTitle || null,
        content: blocksToPlainText(contentBlocks),
        content_blocks: contentBlocks,
        cover_image: coverImage,
        author,
      }
    }

    if (paragraphs.length > 0) {
      return {
        title: pageTitle || null,
        content: paragraphs.join('\n\n'),
        content_blocks: paragraphs.map((paragraph) => ({
          type: 'paragraph',
          content: paragraph,
        })),
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
      content_blocks: [],
      cover_image: coverImage,
      author,
    }
  } catch {
    return {
      title: null,
      content: '',
      content_blocks: [],
      cover_image: null,
      author: null,
    }
  }
}

export type AnthropicListItem = {
  href: string
  rawText: string
  dateText: string
  title: string
  category: string
  fullUrl: string
  externalId: string
}

export async function fetchAnthropicListItems() {
  const response = await fetch('https://www.anthropic.com/news', {
    headers: {
      'User-Agent': 'Mozilla/5.0',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`抓取失败，状态码 ${response.status}`)
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

  return uniqueRawItems.map((rawItem) => {
    const { href, rawText } = rawItem
    const dateMatch = rawText.match(/[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}/)
    const dateText = dateMatch ? dateMatch[0] : ''
    const cleaned = rawText.replace(dateText, '').trim()
    const categories = ['Product', 'Announcements', 'Policy', 'Research']
    let category = 'News'
    let title = cleaned

    for (const candidateCategory of categories) {
      if (cleaned.startsWith(candidateCategory)) {
        category = candidateCategory
        title = cleaned.slice(candidateCategory.length).trim()
        break
      }
    }

    return {
      href,
      rawText,
      dateText,
      title,
      category,
      fullUrl: `https://www.anthropic.com${href}`,
      externalId: `anthropic:${href}`,
    }
  })
}
