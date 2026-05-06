import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'
import { authorizeDebugRoute } from '@/lib/debug-route-auth'
import { cleanInlineText as cleanText, toAbsoluteUrl } from '@/lib/news-import/common'
import type { AnyNode } from 'domhandler'

type DebugMediaCandidate = {
  type: 'image' | 'video'
  src: string | null
  alt: string
  caption: string
  tag: string
  context: string
  decision: 'keep' | 'skip'
  reason: string
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

function getVideoSrc($el: cheerio.Cheerio<AnyNode>, fullUrl: string) {
  const src =
    $el.attr('src') ||
    $el.attr('data-src') ||
    $el.find('source').first().attr('src') ||
    $el.find('source').first().attr('data-src')

  return toAbsoluteUrl(src, fullUrl)
}

function imageKey(src: string) {
  try {
    const url = new URL(src)
    url.search = ''
    return (
      url.pathname.split('/').filter(Boolean).pop()?.toLowerCase() ||
      url.toString().toLowerCase()
    )
  } catch {
    return src.toLowerCase()
  }
}

function isNonArticleContext($el: cheerio.Cheerio<AnyNode>) {
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

function isLikelyNonContentImage(src: string, alt: string, caption: string) {
  const lower = `${src} ${alt} ${caption}`.toLowerCase()

  return (
    lower.endsWith('.svg') ||
    lower.includes('/icons/') ||
    lower.includes('/icon/') ||
    lower.includes('logo') ||
    lower.includes('avatar') ||
    lower.includes('tracking') ||
    lower.includes('placeholder') ||
    lower.includes('transparent') ||
    lower.includes('spacer') ||
    lower.includes('blur') ||
    lower.includes('newsletter') ||
    lower.includes('subscribe')
  )
}

function getContext($el: cheerio.Cheerio<AnyNode>) {
  const context = [
    $el.closest('figure').length ? 'figure' : '',
    $el.closest('[class*="carousel"]').length ? 'carousel' : '',
    $el.closest('[class*="slider"]').length ? 'slider' : '',
    $el.closest('[class*="newsletter"]').length ? 'newsletter' : '',
    $el.closest('[class*="subscribe"]').length ? 'subscribe' : '',
    $el.closest('header, nav, footer, aside').length ? 'layout' : '',
  ].filter(Boolean)

  return context.join(', ') || 'article'
}

function pickContentContainer(
  $: cheerio.CheerioAPI
): cheerio.Cheerio<AnyNode> | null {
  const selectors = [
    '._amgj',
    '._7h8s',
    'article',
    'main article',
    'main',
    '[role="main"]',
    '.prose',
    '[class*="article"]',
    '[class*="content"]',
    'body',
  ]
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

function inspectMediaCandidates($: cheerio.CheerioAPI, fullUrl: string) {
  const $container = pickContentContainer($)
  if (!$container) return []

  const seen = new Set<string>()
  let hasStartedBodyText = false
  const candidates: DebugMediaCandidate[] = []

  $container
    .find('h2, h3, p, blockquote, figure, picture, img, video')
    .each((_, el) => {
      const $el = $(el)
      const tag = el.tagName?.toLowerCase() || 'unknown'

      if (tag === 'h2' || tag === 'h3' || tag === 'p' || tag === 'blockquote') {
        if (cleanText($el.text())) hasStartedBodyText = true
        return
      }

      if (tag !== 'figure' && tag !== 'picture' && tag !== 'img' && tag !== 'video') {
        return
      }

      if (tag !== 'figure' && $el.closest('figure').length) return

      const $img = tag === 'figure' || tag === 'picture' ? $el.find('img').first() : $el
      const type = tag === 'video' || $el.find('video').length ? 'video' : 'image'
      const src =
        type === 'video'
          ? getVideoSrc($el.is('video') ? $el : $el.find('video').first(), fullUrl)
          : getImageSrc($el, fullUrl)
      const alt = cleanText($img.attr('alt') || '')
      const caption = cleanText($el.closest('figure').find('figcaption').text())
      const key = src ? imageKey(src) : ''
      let decision: DebugMediaCandidate['decision'] = 'keep'
      let reason = 'content media'

      if (!src) {
        decision = 'skip'
        reason = 'missing src'
      } else if (!hasStartedBodyText) {
        decision = 'skip'
        reason = 'before body text, likely hero media'
      } else if (seen.has(key)) {
        decision = 'skip'
        reason = 'duplicate media'
      } else if (isNonArticleContext($el)) {
        decision = 'skip'
        reason = `non-article context: ${getContext($el)}`
      } else if (type === 'image' && isLikelyNonContentImage(src, alt, caption)) {
        decision = 'skip'
        reason = 'logo/icon/placeholder/newsletter-like image'
      } else if (type === 'image' && tag !== 'figure' && !alt) {
        decision = 'skip'
        reason = 'standalone image without alt text'
      }

      if (src && decision === 'keep') seen.add(key)

      candidates.push({
        type,
        src,
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
  const authError = authorizeDebugRoute(request)
  if (authError) return authError

  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json(
      { error: '请提供 url 参数，例如 /api/test/meta-detail?url=https://ai.meta.com/blog/...' },
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
    const mediaCandidates = inspectMediaCandidates($, url)
    const keptMedia = mediaCandidates.filter((item) => item.decision === 'keep')
    const skippedMedia = mediaCandidates.filter((item) => item.decision === 'skip')

    return NextResponse.json({
      url,
      title: cleanText($('title').text()),
      dom_counts: {
        article_count: $('article').length,
        main_count: $('main').length,
        paragraph_count: $('article p, main p, [role="main"] p, .prose p').length,
        image_count: $('article img, main img, [role="main"] img, .prose img').length,
        video_count: $('article video, main video, [role="main"] video, .prose video').length,
        figure_count: $('article figure, main figure, [role="main"] figure, .prose figure').length,
      },
      block_preview: {
        paragraphs: $('article p, main p, [role="main"] p, .prose p')
          .map((_, el) => cleanText($(el).text()))
          .get()
          .filter((text) => text.length > 30)
          .slice(0, 8),
        kept_media: keptMedia,
        skipped_media: skippedMedia.slice(0, 30),
      },
      media_summary: {
        total_candidates: mediaCandidates.length,
        kept: keptMedia.length,
        skipped: skippedMedia.length,
        skip_reasons: skippedMedia.reduce<Record<string, number>>((acc, item) => {
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
