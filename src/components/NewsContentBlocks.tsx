type TextBlock = {
  type: 'paragraph' | 'quote'
  content: string
}

type HeadingBlock = {
  type: 'heading'
  level?: 2 | 3
  content: string
}

type ImageBlock = {
  type: 'image'
  src: string
  alt?: string
  caption?: string
}

type VideoBlock = {
  type: 'video'
  src: string
  poster?: string
  caption?: string
}

type TableBlock = {
  type: 'table'
  headers: string[]
  rows: string[][]
}

type CodeBlock = {
  type: 'code'
  language?: string
  content: string
}

export type NewsContentBlock =
  | TextBlock
  | HeadingBlock
  | ImageBlock
  | VideoBlock
  | TableBlock
  | CodeBlock

interface NewsContentBlocksProps {
  blocks?: NewsContentBlock[] | null
  coverImage?: string | null
  fallbackContent?: string | null
  sourceUrl?: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeBlocks(blocks: unknown): NewsContentBlock[] {
  if (!Array.isArray(blocks)) return []

  return blocks.flatMap<NewsContentBlock>((block) => {
    if (!isRecord(block) || typeof block.type !== 'string') return []

    if (
      (block.type === 'paragraph' || block.type === 'quote') &&
      typeof block.content === 'string'
    ) {
      return [{ type: block.type, content: block.content }]
    }

    if (block.type === 'heading' && typeof block.content === 'string') {
      return [
        {
          type: 'heading' as const,
          level: block.level === 3 ? 3 : 2,
          content: block.content,
        },
      ]
    }

    if (block.type === 'image' && typeof block.src === 'string') {
      return [
        {
          type: 'image' as const,
          src: block.src,
          alt: typeof block.alt === 'string' ? block.alt : undefined,
          caption:
            typeof block.caption === 'string' ? block.caption : undefined,
        },
      ]
    }

    if (block.type === 'video' && typeof block.src === 'string') {
      return [
        {
          type: 'video' as const,
          src: block.src,
          poster: typeof block.poster === 'string' ? block.poster : undefined,
          caption:
            typeof block.caption === 'string' ? block.caption : undefined,
        },
      ]
    }

    if (block.type === 'table' && Array.isArray(block.headers)) {
      const headers = block.headers.filter(
        (header): header is string => typeof header === 'string'
      )
      const rows = Array.isArray(block.rows)
        ? block.rows
            .filter((row): row is unknown[] => Array.isArray(row))
            .map((row) =>
              row.map((cell) => (typeof cell === 'string' ? cell : String(cell ?? '')))
            )
            .filter((row) => row.length)
        : []

      if (headers.length && rows.length) {
        return [{ type: 'table' as const, headers, rows }]
      }
    }

    if (block.type === 'code' && typeof block.content === 'string') {
      return [
        {
          type: 'code' as const,
          language:
            typeof block.language === 'string' ? block.language : undefined,
          content: block.content,
        },
      ]
    }

    return []
  })
}

function fallbackBlocks(content?: string | null): TextBlock[] {
  if (!content) return []

  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({
      type: 'paragraph',
      content: paragraph,
    }))
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

function isLikelyNonContentImage(block: ImageBlock) {
  const lower = `${block.src} ${block.alt || ''} ${block.caption || ''}`.toLowerCase()

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
    lower.includes('subscribe') ||
    lower.includes('inbox') ||
    lower.includes('google_g') ||
    lower.includes('google-g') ||
    lower.includes('google-logo')
  )
}

function filterDuplicateImages(
  blocks: NewsContentBlock[],
  coverImage?: string | null
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
          block.type === 'quote' ||
          block.type === 'code') &&
          block.content.trim()
      ) {
        hasStartedBodyText = true
      }

      if (block.type === 'table' && block.rows.length) {
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

    if (isLikelyNonContentImage(block)) return false
    if (!hasStartedBodyText) return false
    if (coverKey && key === coverKey) return false
    if (seenImages.has(key)) return false

    seenImages.add(key)
    return true
  })
}

export default function NewsContentBlocks({
  blocks,
  coverImage,
  fallbackContent,
  sourceUrl,
}: NewsContentBlocksProps) {
  const normalizedBlocks = normalizeBlocks(blocks)
  const renderBlocks = normalizedBlocks.length
    ? filterDuplicateImages(normalizedBlocks, coverImage)
    : fallbackBlocks(fallbackContent)

  if (!renderBlocks.length) {
    return (
      <div className="rounded-lg border border-border bg-white/70 p-4 text-sm text-sub">
        当前页面暂未抓取到可展示正文，完整内容请查看原文。
      </div>
    )
  }

  return (
    <article className="min-w-0 max-w-full space-y-5 rounded-lg border border-border bg-white/75 p-5">
      {renderBlocks.map((block, index) => {
        if (block.type === 'heading') {
          const HeadingTag = block.level === 3 ? 'h3' : 'h2'

          return (
            <HeadingTag
              key={`${block.type}-${index}`}
              className="pt-2 font-serif text-xl font-bold leading-snug text-text"
            >
              {block.content}
            </HeadingTag>
          )
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={`${block.type}-${index}`}
              className="border-l-4 border-link bg-white/70 px-4 py-3 text-base leading-8 text-sub"
            >
              {block.content}
            </blockquote>
          )
        }

        if (block.type === 'image') {
          return (
            <figure key={`${block.type}-${index}`} className="space-y-2">
              <img
                src={block.src}
                alt={block.alt || ''}
                className="max-h-[560px] w-full rounded-lg border border-border object-contain"
              />
              {block.caption ? (
                <figcaption className="text-sm leading-6 text-sub">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          )
        }

        if (block.type === 'video') {
          return (
            <figure key={`${block.type}-${index}`} className="space-y-2">
              <video
                src={block.src}
                poster={block.poster}
                controls
                muted
                playsInline
                preload="metadata"
                className="max-h-[560px] w-full rounded-lg border border-border bg-black object-contain"
              />
              {block.caption ? (
                <figcaption className="text-sm leading-6 text-sub">
                  {block.caption}
                </figcaption>
              ) : null}
            </figure>
          )
        }

        if (block.type === 'table') {
          return (
            <div
              key={`${block.type}-${index}`}
              className="max-w-full overflow-x-auto rounded-lg border border-border bg-white"
            >
              <table className="min-w-full border-collapse text-left text-sm text-text">
                <thead className="bg-sec-bg">
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={`${header}-${headerIndex}`}
                        className="whitespace-nowrap border-b border-border px-4 py-3 font-semibold"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border last:border-0">
                      {block.headers.map((_, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="whitespace-nowrap px-4 py-3 align-top"
                        >
                          {row[cellIndex] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }

        if (block.type === 'code') {
          return (
            <figure
              key={`${block.type}-${index}`}
              className="min-w-0 max-w-full overflow-hidden rounded-lg border border-border bg-[#f3f3f1]"
            >
              {block.language ? (
                <figcaption className="border-b border-border px-4 py-3 text-sm font-semibold text-text">
                  {block.language}
                </figcaption>
              ) : null}
              <pre className="max-w-full whitespace-pre-wrap break-words p-4 text-sm leading-6 text-gray-900">
                <code className="break-words font-mono">{block.content}</code>
              </pre>
            </figure>
          )
        }

        if (block.type === 'paragraph') {
          return (
            <p
              key={`${block.type}-${index}`}
              className="text-base leading-8 text-gray-800"
            >
              {block.content}
            </p>
          )
        }

        return null
      })}

      {sourceUrl ? (
        <div className="border-t border-border pt-4 text-sm">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link hover:underline"
          >
            查看原文 →
          </a>
        </div>
      ) : null}
    </article>
  )
}
