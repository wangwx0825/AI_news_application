import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'

type DeepMindPageVariant = 'standard-article' | 'component-heavy'
type DeepMindPageFamily = 'deepmind-site' | 'google-blog'

type DebugImageCandidate = {
  src: string | null
  upgraded_src: string | null
  alt: string
  caption: string
  tag: string
  context: string
  decision: 'keep' | 'skip'
  reason: string
}

function cleanText(text: string) {
  return text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
}

function toAbsoluteUrl(url: string | undefined, baseUrl: string) {
  if (!url) return null
  try {
    return new URL(url, baseUrl).toString()
  } catch {
    return null
  }
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

  return upgradeImageUrl(toAbsoluteUrl(src, fullUrl))
}

function imageKey(src: string) {
  try {
    const url = new URL(src)
    url.search = ''
    return url.pathname.split('/').filter(Boolean).pop()?.toLowerCase() || url.toString().toLowerCase()
  } catch {
    return src.toLowerCase()
  }
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
        '[class*="gallery"]',
        '[class*="testimonial"]',
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

function isLikelyNonContentImage(src: string, alt: string, caption: string) {
  const lower = `${src} ${alt} ${caption}`.toLowerCase()

  return (
    lower.endsWith('.svg') ||
    lower.includes('/icons/') ||
    lower.includes('/icon/') ||
    lower.includes('logo') ||
    lower.includes('avatar') ||
    lower.includes('icon') ||
    lower.includes('tracking') ||
    lower.includes('placeholder') ||
    lower.includes('transparent') ||
    lower.includes('spacer') ||
    lower.includes('blur') ||
    lower.includes('fallback/video_poster_fallback') ||
    lower.includes('newsletter') ||
    lower.includes('subscribe') ||
    lower.includes('inbox') ||
    lower.includes('google_g') ||
    lower.includes('google-g') ||
    lower.includes('google-logo')
  )
}

function hasFigureLikeCaption(caption: string) {
  return /^(figure|fig\.|image|chart|table)\s*\d+/i.test(caption.trim())
}

function detectPageFamily(fullUrl: string): DeepMindPageFamily {
  try {
    const hostname = new URL(fullUrl).hostname
    return hostname.includes('blog.google') ? 'google-blog' : 'deepmind-site'
  } catch {
    return 'deepmind-site'
  }
}

function isLikelyGoogleBlogContentMedia(src: string, alt: string) {
  const lower = `${src} ${alt}`.toLowerCase()

  if (lower.includes('_quote_')) return false
  if (lower.includes('quote from')) return false
  if (lower.includes('.width-100.')) return false

  return lower.includes('/original_images/') || lower.includes('.gif')
}

function detectVariant($: cheerio.CheerioAPI): DeepMindPageVariant {
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
  const imageCount = $('article img, main img, [role="main"] img').length
  const paragraphCount = $('article p, main p, [role="main"] p')
    .map((_, el) => cleanText($(el).text()))
    .get()
    .filter((text) => text.length > 40).length

  if (componentCount > 0) return 'component-heavy'
  if (imageCount >= 8 && imageCount > paragraphCount) return 'component-heavy'

  return 'standard-article'
}

function getContext($el: cheerio.Cheerio<AnyNode>) {
  const context = [
    $el.closest('figure').length ? 'figure' : '',
    $el.closest('[class*="carousel"]').length ? 'carousel' : '',
    $el.closest('[class*="slider"]').length ? 'slider' : '',
    $el.closest('[class*="gallery"]').length ? 'gallery' : '',
    $el.closest('[class*="newsletter"]').length ? 'newsletter' : '',
    $el.closest('[class*="subscribe"]').length ? 'subscribe' : '',
    $el.closest('header, nav, footer, aside').length ? 'layout' : '',
  ].filter(Boolean)

  return context.join(', ') || 'article'
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
        .map((__, paragraph) => cleanText($(paragraph).text()))
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

function inspectImageCandidates(
  $: cheerio.CheerioAPI,
  fullUrl: string,
  variant: DeepMindPageVariant,
  pageFamily: DeepMindPageFamily,
  coverImage: string | null
) {
  const seen = new Set<string>()
  const coverKey = coverImage ? imageKey(coverImage) : null
  let hasStartedBodyText = false
  const candidates: DebugImageCandidate[] = []
  const $container = pickContentContainer($)

  if (!$container) return candidates

  $container
    .find('h2, h3, p, blockquote, figure, picture, img')
    .each((_, el) => {
      const $el = $(el)
      const tag = el.tagName?.toLowerCase() || 'unknown'

      if (tag === 'h2' || tag === 'h3' || tag === 'p' || tag === 'blockquote') {
        if (cleanText($el.text())) hasStartedBodyText = true
        return
      }

      if (tag !== 'figure' && tag !== 'picture' && tag !== 'img') return
      if (tag !== 'figure' && $el.closest('figure').length) return

      const $img = tag === 'figure' || tag === 'picture' ? $el.find('img').first() : $el
      const src = getImageSrc($el, fullUrl)
      const alt = cleanText($img.attr('alt') || '')
      const caption = cleanText($el.closest('figure').find('figcaption').text())
      const key = src ? imageKey(src) : ''
      let decision: DebugImageCandidate['decision'] = 'keep'
      let reason = 'content image'

      if (!src) {
        decision = 'skip'
        reason = 'missing src'
      } else if (!hasStartedBodyText) {
        decision = 'skip'
        reason = 'before body text, likely hero image'
      } else if (coverKey && key === coverKey) {
        decision = 'skip'
        reason = 'same as cover image'
      } else if (seen.has(key)) {
        decision = 'skip'
        reason = 'duplicate image'
      } else if (isNonArticleImageContext($el)) {
        decision = 'skip'
        reason = `non-article context: ${getContext($el)}`
      } else if (isLikelyNonContentImage(src, alt, caption)) {
        decision = 'skip'
        reason = 'logo/icon/placeholder/newsletter-like image'
      } else if (tag !== 'figure' && !alt) {
        decision = 'skip'
        reason = 'standalone image without alt text'
      } else if (
        variant === 'component-heavy' &&
        tag !== 'figure' &&
        !(
          pageFamily === 'google-blog' &&
          src &&
          isLikelyGoogleBlogContentMedia(src, alt)
        )
      ) {
        decision = 'skip'
        reason = 'component-heavy page keeps only captioned figures'
      } else if (variant === 'component-heavy' && !hasFigureLikeCaption(caption)) {
        if (
          !(
            pageFamily === 'google-blog' &&
            src &&
            isLikelyGoogleBlogContentMedia(src, alt)
          )
        ) {
          decision = 'skip'
          reason = 'component-heavy figure without Figure-style caption'
        }
      }

      if (src && decision === 'keep') seen.add(key)

      candidates.push({
        src,
        upgraded_src: src,
        alt,
        caption,
        tag,
        context: getContext($el),
        decision,
        reason,
      })
    })

  return candidates
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const expected = `Bearer ${process.env.CRON_SECRET}`

  if (process.env.CRON_SECRET && authHeader !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: '请提供 url 参数，例如 /api/test/deepmind-detail?url=https://deepmind.google/...' },
      { status: 400 }
    )
  }

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
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
    const variant = detectVariant($)
    const pageFamily = detectPageFamily(url)
    const coverImage = upgradeImageUrl(
      toAbsoluteUrl(
        $('meta[property="og:image"]').attr('content') ||
          $('meta[name="twitter:image"]').attr('content'),
        url
      )
    )
    const imageCandidates = inspectImageCandidates(
      $,
      url,
      variant,
      pageFamily,
      coverImage
    )
    const keptImages = imageCandidates.filter((item) => item.decision === 'keep')
    const skippedImages = imageCandidates.filter((item) => item.decision === 'skip')
    const paragraphPreview = $('article p, main p, [role="main"] p')
      .map((_, el) => cleanText($(el).text()))
      .get()
      .filter((text) => text.length > 30)
      .slice(0, 8)

    return NextResponse.json({
      url,
      title: cleanText($('title').text()),
      variant,
      page_family: pageFamily,
      cover_image: coverImage,
      dom_counts: {
        article_count: $('article').length,
        main_count: $('main').length,
        paragraph_count: $('article p, main p, [role="main"] p').length,
        image_count: $('article img, main img, [role="main"] img').length,
        figure_count: $('article figure, main figure, [role="main"] figure').length,
        carousel_like_count: $(
          '[class*="carousel"], [class*="slider"], [class*="swiper"], [class*="slideshow"], [class*="gallery"]'
        ).length,
      },
      block_preview: {
        paragraphs: paragraphPreview,
        kept_images: keptImages,
        skipped_images: skippedImages.slice(0, 30),
      },
      image_summary: {
        total_candidates: imageCandidates.length,
        kept: keptImages.length,
        skipped: skippedImages.length,
        skip_reasons: skippedImages.reduce<Record<string, number>>((acc, item) => {
          acc[item.reason] = (acc[item.reason] || 0) + 1
          return acc
        }, {}),
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '未知错误' },
      { status: 500 }
    )
  }
}
