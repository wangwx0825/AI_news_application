import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import { cleanInlineText, toAbsoluteUrl } from './common'

export type DeepMindContentBlock =
  | { type: 'heading'; level: 2 | 3; content: string }
  | { type: 'paragraph'; content: string }
  | { type: 'quote'; content: string }
  | { type: 'image'; src: string; alt?: string; caption?: string }
  | { type: 'audio'; src: string }
  | { type: 'video'; src: string; poster?: string; caption?: string }

export type DeepMindDetailResult = {
  title: string | null
  content: string
  content_blocks: DeepMindContentBlock[]
  cover_image: string | null
  published_at: string | null
  author: string | null
}

export type DeepMindPageVariant = 'standard-article' | 'component-heavy'
export type DeepMindPageFamily = 'deepmind-site' | 'google-blog'

const supabaseSafeText = (text: string) => text.replace(/\u0000/g, '')

export function cleanDeepMindTitle(text: string, source: 'Google DeepMind' | 'Stability AI') {
  const cleaned = cleanInlineText(text)

  if (!cleaned) return cleaned

  const escapedSource = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  return cleaned
    .replace(new RegExp(`\\s*[—–-]{1,2}\\s*${escapedSource}\\s*$`, 'i'), '')
    .replace(new RegExp(`\\s*\\|\\s*${escapedSource}\\s*$`, 'i'), '')
    .trim()
}

function cleanParagraph(text: string) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseDeepMindDate(dateText: string | undefined) {
  if (!dateText) return null
  const parsed = new Date(dateText)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

export function upgradeDeepMindImageUrl(src: string | null) {
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

  if (
    cleaned.length < 80 &&
    /^[A-Z][A-Za-z.'-]+(?:\s+(?:and|&)\s+|\s+)[A-Z][A-Za-z.'-]+/.test(cleaned) &&
    !/[.!?]/.test(cleaned)
  ) {
    return true
  }

  return false
}

export function buildDeepMindSummaryFromBlocks(
  blocks: DeepMindContentBlock[],
  fallbackCategory: string
) {
  for (const block of blocks) {
    if (block.type !== 'paragraph') continue

    const text = cleanInlineText(block.content)
    if (isLikelyBadSummary(text)) continue

    return text.slice(0, 220).trim()
  }

  return `${fallbackCategory} | 来源：Google DeepMind`
}

function blocksToPlainText(blocks: DeepMindContentBlock[]) {
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

export function inferDeepMindCategory(text: string) {
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
    const parsed = parseDeepMindDate(candidate)
    if (parsed) return parsed
  }

  const bodyText = cleanInlineText($('body').text())
  const match = bodyText.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/
  )

  if (match) {
    return parseDeepMindDate(match[0])
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
  if (lower.includes('fallback/video_poster_fallback')) return false
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

function getImageSrc($img: cheerio.Cheerio<AnyNode>, fullUrl: string) {
  const src =
    pickLargestFromSrcset($img.attr('srcset')) ||
    pickLargestFromSrcset($img.attr('data-srcset')) ||
    $img.attr('src') ||
    $img.attr('data-src') ||
    $img.attr('data-original')

  if (src && !isLikelyPlaceholderImage(src)) {
    return upgradeDeepMindImageUrl(toAbsoluteUrl(src, fullUrl))
  }

  return null
}

function getPictureSrc($picture: cheerio.Cheerio<AnyNode>, fullUrl: string) {
  const sourceSrcset =
    $picture.find('source').last().attr('srcset') ||
    $picture.find('source').last().attr('data-srcset')
  const sourceSrc = pickLargestFromSrcset(sourceSrcset)

  if (sourceSrc && !isLikelyPlaceholderImage(sourceSrc)) {
    return upgradeDeepMindImageUrl(toAbsoluteUrl(sourceSrc, fullUrl))
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

export function detectDeepMindPageFamily(fullUrl: string): DeepMindPageFamily {
  try {
    const hostname = new URL(fullUrl).hostname
    return hostname.includes('blog.google') ? 'google-blog' : 'deepmind-site'
  } catch {
    return 'deepmind-site'
  }
}

export function detectDeepMindPageVariant($: cheerio.CheerioAPI): DeepMindPageVariant {
  const componentSelectors = [
    '[class*="carousel"]',
    '[class*="slider"]',
    '[class*="swiper"]',
    '[class*="glide"]',
    '[class*="slick"]',
    '[class*="slideshow"]',
    '[class*="gallery"]',
    '[class*="testimonial"]',
    '[class*="quote-card"]',
    '[data-module*="carousel"]',
    '[data-component*="carousel"]',
  ].join(',')

  const componentCount = $(componentSelectors).length
  const articleImageCount = $('article img, main img, [role="main"] img').length
  const articleParagraphCount = $('article p, main p, [role="main"] p')
    .map((_, el) => cleanParagraph($(el).text()))
    .get()
    .filter((text) => text.length > 40).length

  if (componentCount > 0) return 'component-heavy'
  if (articleImageCount >= 8 && articleImageCount > articleParagraphCount) {
    return 'component-heavy'
  }

  return 'standard-article'
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

function hasFigureLikeCaption(caption: string) {
  return /^(figure|fig\.|image|chart|table)\s*\d+/i.test(caption.trim())
}

function isLikelyGoogleBlogContentMedia(src: string, alt: string) {
  const lower = `${src} ${alt}`.toLowerCase()

  if (lower.includes('_quote_')) return false
  if (lower.includes('quote from')) return false
  if (lower.includes('.width-100.')) return false

  return lower.includes('/original_images/') || lower.includes('.gif')
}

function pickContentContainer(
  $: cheerio.CheerioAPI
): cheerio.Cheerio<AnyNode> | null {
  const selectors = ['article', 'main', '[role="main"]']
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
      const mediaCount = candidate.find('figure, picture, img').length
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

export function extractDeepMindContentBlocks(
  $: cheerio.CheerioAPI,
  fullUrl: string,
  variant: DeepMindPageVariant,
  pageFamily: DeepMindPageFamily
): DeepMindContentBlock[] {
  const blocks: DeepMindContentBlock[] = []
  const seenImages = new Set<string>()
  const seenMedia = new Set<string>()
  const $container = pickContentContainer($)

  if (!$container) return blocks

  const $elements = $container.find(
    'h2, h3, p, figure, img, picture, audio, video, blockquote'
  )

  $elements.each((_, el) => {
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
        !isLikelyBadSummary(text) &&
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
      if (isNonArticleImageContext($el)) return

      const $img = $el.find('img').first()
      const src = getImageSrc($img, fullUrl)
      const alt = cleanInlineText($img.attr('alt') || '')
      const caption = cleanInlineText($el.find('figcaption').text())

      if (variant === 'component-heavy' && !hasFigureLikeCaption(caption)) {
        return
      }

      if (src && !seenImages.has(src) && isLikelyContentImage(src, alt)) {
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
      if (isNonArticleImageContext($el)) return

      const src = getPictureSrc($el, fullUrl)
      const alt = cleanInlineText($el.find('img').first().attr('alt') || '')

      if (!alt) return
      if (
        variant === 'component-heavy' &&
        !(
          pageFamily === 'google-blog' &&
          src &&
          isLikelyGoogleBlogContentMedia(src, alt)
        )
      ) {
        return
      }

      if (src && !seenImages.has(src) && isLikelyContentImage(src, alt)) {
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
      if (isNonArticleImageContext($el)) return

      const src = getImageSrc($el, fullUrl)
      const alt = cleanInlineText($el.attr('alt') || '')

      if (!alt) return
      if (
        variant === 'component-heavy' &&
        !(
          pageFamily === 'google-blog' &&
          src &&
          isLikelyGoogleBlogContentMedia(src, alt)
        )
      ) {
        return
      }

      if (src && !seenImages.has(src) && isLikelyContentImage(src, alt)) {
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

function isLikelyByline(text: string, author: string | null) {
  const cleaned = cleanInlineText(text)
  if (!cleaned) return true
  if (/^by\s+/i.test(cleaned)) return true
  if (!author) return false

  return cleaned.toLowerCase() === author.toLowerCase()
}

function deriveAuthorFromBlocks(blocks: DeepMindContentBlock[]) {
  const firstTextBlock = blocks.find(
    (block) =>
      block.type === 'paragraph' ||
      block.type === 'heading' ||
      block.type === 'quote'
  )

  if (!firstTextBlock) return null

  const text = cleanInlineText(firstTextBlock.content)
  if (!text) return null
  if (text.length > 140) return null
  if (/[.!?。！？]$/.test(text)) return null
  if (/^(research|product|news|announcement|announcements)$/i.test(text)) {
    return null
  }
  if (
    /^(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
      text
    )
  ) {
    return null
  }

  return text.replace(/^by\s+/i, '').trim()
}

function removeDuplicateTextBlocks(blocks: DeepMindContentBlock[], author: string | null) {
  const seenText = new Set<string>()

  return blocks.filter((block) => {
    if (
      block.type !== 'paragraph' &&
      block.type !== 'heading' &&
      block.type !== 'quote'
    ) {
      return true
    }

    const text = cleanInlineText(block.content)
    const key = text.toLowerCase()

    if (block.type === 'paragraph' && isLikelyByline(text, author)) {
      return false
    }

    if (seenText.has(key)) {
      return false
    }

    seenText.add(key)
    return true
  })
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
  blocks: DeepMindContentBlock[],
  coverImage: string | null
) {
  const seenImages = new Set<string>()
  const coverKey = coverImage ? imageKey(coverImage) : null
  let hasStartedBodyText = false

  return blocks.filter((block) => {
    if (block.type !== 'image') {
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

    const key = imageKey(block.src)

    if (!hasStartedBodyText) return false
    if (coverKey && key === coverKey) return false
    if (seenImages.has(key)) return false

    seenImages.add(key)
    return true
  })
}

export async function fetchDeepMindDetail(fullUrl: string): Promise<DeepMindDetailResult> {
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

    const pageTitle = cleanDeepMindTitle(
      cleanInlineText($('title').text())
        .replace(/\s*\\\s*Google DeepMind\s*$/i, '')
        .replace(/\s*\|\s*Google Blog\s*$/i, '')
        .replace(/\s*\\\s*Google Blog\s*$/i, ''),
      'Google DeepMind'
    )

    const coverImage = extractCoverImage($, fullUrl)
    const publishedAt = extractDetailDate($)
    const pageVariant = detectDeepMindPageVariant($)
    const pageFamily = detectDeepMindPageFamily(fullUrl)
    const extractedBlocks = extractDeepMindContentBlocks(
      $,
      fullUrl,
      pageVariant,
      pageFamily
    )
    const author = extractAuthor($) || deriveAuthorFromBlocks(extractedBlocks)
    const contentBlocks = removeDuplicateImages(
      removeDuplicateTextBlocks(extractedBlocks, author),
      coverImage
    )
    let content = blocksToPlainText(contentBlocks)

    const hasParagraphBlocks = contentBlocks.some(
      (block) => block.type === 'paragraph'
    )

    if (!hasParagraphBlocks) {
      const fallbackParagraphs = extractParagraphs($)

      if (fallbackParagraphs.length > 0) {
        const fallbackBlocks: DeepMindContentBlock[] = fallbackParagraphs.map((text) => ({
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

export type RawDeepMindItem = {
  title: string
  link: string
  category: string
}

export async function fetchDeepMindListItems() {
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
        category: inferDeepMindCategory(title),
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
