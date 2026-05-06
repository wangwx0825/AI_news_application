import { createClient } from '@supabase/supabase-js'
import { slugify } from '@/lib/news-import/common'
import {
  buildAnthropicSummary,
  fetchAnthropicDetail,
  fetchAnthropicListItems,
  parseAnthropicDate,
} from '@/lib/news-import/anthropic'
import {
  buildDeepMindSummaryFromBlocks,
  cleanDeepMindTitle,
  fetchDeepMindDetail,
  fetchDeepMindListItems,
} from '@/lib/news-import/deepmind'
import {
  fetchHuggingFaceDetail,
  fetchHuggingFaceRssItems,
  parseHuggingFaceDate,
} from '@/lib/news-import/huggingface'
import { fetchMetaDetail, fetchMetaListItems } from '@/lib/news-import/meta'
import {
  fetchMistralDetail,
  fetchMistralListItems,
} from '@/lib/news-import/mistral'
import {
  fetchOpenAIDetail,
  fetchOpenAIRssItems,
  inferOpenAICategory,
  parseOpenAIDate,
} from '@/lib/news-import/openai'
import {
  cleanStabilityTitle,
  fetchStabilityDetail,
  fetchStabilityListItems,
} from '@/lib/news-import/stability'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type ImportResult = {
  message: string
  total_found: number
  inserted: number
  skipped: number
  errors: Array<{ external_id: string; message: string }>
}

export type ImportOptions = {
  refreshExisting?: boolean
}

export type ImportRunner = (options?: ImportOptions) => Promise<ImportResult>

function buildWriteStats() {
  return {
    inserted: 0,
    skipped: 0,
    errors: [] as Array<{ external_id: string; message: string }>,
  }
}

async function upsertNews(
  record: Record<string, unknown>,
  stats: ReturnType<typeof buildWriteStats>
) {
  const externalId = String(record.external_id || '')
  const { error } = await supabase.from('news').upsert(record, {
    onConflict: 'external_id',
    ignoreDuplicates: false,
  })

  if (error) {
    console.error('写入失败:', externalId, error.message)
    stats.errors.push({
      external_id: externalId,
      message: error.message,
    })
  } else {
    stats.inserted += 1
  }
}

async function getExistingExternalIds(externalIds: string[]) {
  if (externalIds.length === 0) return new Set<string>()

  const { data, error } = await supabase
    .from('news')
    .select('external_id')
    .in('external_id', externalIds)

  if (error) {
    throw new Error(`查询已有新闻失败：${error.message}`)
  }

  return new Set((data || []).map((item) => item.external_id as string))
}

function shouldSkipExisting(
  externalId: string,
  existingExternalIds: Set<string>,
  stats: ReturnType<typeof buildWriteStats>,
  options?: ImportOptions
) {
  if (options?.refreshExisting || !existingExternalIds.has(externalId)) {
    return false
  }

  stats.skipped += 1
  return true
}

async function ensureUniqueNewsSlug(title: string, externalId: string) {
  const baseSlug = slugify(title) || externalId.replace(/[^a-zA-Z0-9]+/g, '-')

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`
    const { data, error } = await supabase
      .from('news')
      .select('external_id')
      .eq('slug', candidate)
      .maybeSingle()

    if (error) {
      throw new Error(`检查 slug 失败：${error.message}`)
    }

    if (!data || data.external_id === externalId) {
      return candidate
    }
  }

  return `${baseSlug}-${externalId.slice(-8).replace(/[^a-zA-Z0-9]+/g, '')}`
}

export async function runAnthropicImport(options?: ImportOptions): Promise<ImportResult> {
  const rawItems = await fetchAnthropicListItems()
  const stats = buildWriteStats()
  const existingExternalIds = await getExistingExternalIds(
    rawItems.map((item) => item.externalId)
  )

  for (const rawItem of rawItems) {
    if (shouldSkipExisting(rawItem.externalId, existingExternalIds, stats, options)) {
      continue
    }

    const detail = await fetchAnthropicDetail(rawItem.fullUrl)
    const finalTitle = detail.title || rawItem.title
    const finalContent =
      detail.content || `${finalTitle}\n\n原文链接：${rawItem.fullUrl}`

    await upsertNews(
      {
        title: finalTitle,
        slug: await ensureUniqueNewsSlug(finalTitle, rawItem.externalId),
        published_at: parseAnthropicDate(rawItem.dateText),
        source: 'Anthropic',
        source_url: rawItem.fullUrl,
        external_id: rawItem.externalId,
        summary: buildAnthropicSummary(finalContent, rawItem.category),
        content: finalContent,
        content_blocks: detail.content_blocks,
        status: '已发布',
        author: detail.author || 'Anthropic',
        cover_image: detail.cover_image,
      },
      stats
    )
  }

  return {
    message: '采集完成',
    total_found: rawItems.length,
    ...stats,
  }
}

export async function runOpenAIImport(options?: ImportOptions): Promise<ImportResult> {
  const rawItems = (await fetchOpenAIRssItems())
    .filter((item) => {
      const link = item.link.toLowerCase()
      return !link.includes('/business/') && !link.includes('/guides-and-resources/')
    })
    .slice(0, 80)

  const uniqueItems = Array.from(
    new Map(rawItems.map((item) => [`openai:${item.link}`, item])).values()
  )
  const stats = buildWriteStats()
  const existingExternalIds = await getExistingExternalIds(
    uniqueItems.map((item) => `openai:${item.link}`)
  )

  for (const rawItem of uniqueItems) {
    const externalId = `openai:${rawItem.link}`
    if (shouldSkipExisting(externalId, existingExternalIds, stats, options)) {
      continue
    }

    const detail = await fetchOpenAIDetail(rawItem.link)
    const category = rawItem.category || inferOpenAICategory(rawItem.link, rawItem.title)
    const summary =
      rawItem.description?.slice(0, 220).trim() ||
      `${category} | 来源：OpenAI`

    const fallbackContent = rawItem.description
      ? `${rawItem.description}\n\n原文链接：${rawItem.link}`
      : `${rawItem.title}\n\n原文链接：${rawItem.link}`

    await upsertNews(
      {
        title: rawItem.title,
        slug: await ensureUniqueNewsSlug(rawItem.title, externalId),
        published_at: parseOpenAIDate(rawItem.pubDate),
        source: 'OpenAI',
        source_url: rawItem.link,
        external_id: externalId,
        summary,
        content: detail.content || fallbackContent,
        content_blocks: detail.content_blocks,
        status: '已发布',
        author: 'OpenAI',
        cover_image: detail.cover_image,
        category,
      },
      stats
    )
  }

  return {
    message: 'OpenAI 采集完成',
    total_found: uniqueItems.length,
    ...stats,
  }
}

export async function runDeepMindImport(options?: ImportOptions): Promise<ImportResult> {
  const rawItems = await fetchDeepMindListItems()
  const stats = buildWriteStats()
  const existingExternalIds = await getExistingExternalIds(
    rawItems.map((item) => `deepmind:${item.link}`)
  )

  for (const rawItem of rawItems) {
    const externalId = `deepmind:${rawItem.link}`
    if (shouldSkipExisting(externalId, existingExternalIds, stats, options)) {
      continue
    }

    const detail = await fetchDeepMindDetail(rawItem.link)
    const finalTitle = cleanDeepMindTitle(
      detail.title || rawItem.title,
      'Google DeepMind'
    )
    const finalBlocks = detail.content_blocks || []
    const finalContent =
      detail.content || `${finalTitle}\n\n原文链接：${rawItem.link}`

    await upsertNews(
      {
        title: finalTitle,
        slug: await ensureUniqueNewsSlug(finalTitle, externalId),
        published_at: detail.published_at,
        source: 'Google DeepMind',
        source_url: rawItem.link,
        external_id: externalId,
        summary: buildDeepMindSummaryFromBlocks(finalBlocks, rawItem.category),
        content: finalContent,
        content_blocks: finalBlocks,
        status: '已发布',
        author: detail.author || 'Google DeepMind',
        cover_image: detail.cover_image,
        category: rawItem.category,
      },
      stats
    )
  }

  return {
    message: 'Google DeepMind 采集完成',
    total_found: rawItems.length,
    ...stats,
  }
}

export async function runMetaImport(options?: ImportOptions): Promise<ImportResult> {
  const uniqueItems = await fetchMetaListItems()
  const stats = buildWriteStats()
  const existingExternalIds = await getExistingExternalIds(
    uniqueItems.map((item) => `meta:${item.href}`)
  )

  for (const rawItem of uniqueItems) {
    const externalId = `meta:${rawItem.href}`
    if (shouldSkipExisting(externalId, existingExternalIds, stats, options)) {
      continue
    }

    const detail = await fetchMetaDetail(rawItem.href)
    const finalTitle = detail.title || rawItem.title

    await upsertNews(
      {
        title: finalTitle,
        slug: await ensureUniqueNewsSlug(finalTitle, externalId),
        published_at: detail.published_at,
        source: 'Meta AI',
        source_url: rawItem.href,
        external_id: externalId,
        summary: 'Meta AI 官方新闻，点击查看原文。',
        content: detail.content,
        content_blocks: detail.content_blocks,
        status: '已发布',
        author: detail.author || 'Meta AI',
        cover_image: detail.cover_image,
        category: 'Meta AI',
      },
      stats
    )
  }

  return {
    message: 'Meta AI 采集完成',
    total_found: uniqueItems.length,
    ...stats,
  }
}

export async function runHuggingFaceImport(options?: ImportOptions): Promise<ImportResult> {
  const rawItems = (await fetchHuggingFaceRssItems()).slice(0, 60)
  const uniqueItems = Array.from(
    new Map(rawItems.map((item) => [`huggingface:${item.link}`, item])).values()
  )
  const stats = buildWriteStats()
  const existingExternalIds = await getExistingExternalIds(
    uniqueItems.map((item) => `huggingface:${item.link}`)
  )

  for (const rawItem of uniqueItems) {
    const externalId = `huggingface:${rawItem.link}`
    if (shouldSkipExisting(externalId, existingExternalIds, stats, options)) {
      continue
    }

    const detail = await fetchHuggingFaceDetail(rawItem.link)
    const finalTitle = detail.title || rawItem.title

    await upsertNews(
      {
        title: finalTitle,
        slug: await ensureUniqueNewsSlug(finalTitle, externalId),
        published_at: detail.published_at || parseHuggingFaceDate(rawItem.pubDate),
        source: 'Hugging Face',
        source_url: rawItem.link,
        external_id: externalId,
        summary: rawItem.description
          ? rawItem.description.slice(0, 220).trim()
          : 'Hugging Face 官方博客，点击查看原文。',
        content: detail.content,
        content_blocks: detail.content_blocks,
        status: '已发布',
        author: detail.author || 'Hugging Face',
        cover_image: detail.cover_image,
        category: 'Hugging Face',
      },
      stats
    )
  }

  return {
    message: 'Hugging Face 采集完成',
    total_found: uniqueItems.length,
    ...stats,
  }
}

export async function runMistralImport(options?: ImportOptions): Promise<ImportResult> {
  const rawItems = await fetchMistralListItems()
  const stats = buildWriteStats()
  const existingExternalIds = await getExistingExternalIds(
    rawItems.map((item) => `mistral:${item.href}`)
  )

  for (const rawItem of rawItems) {
    const externalId = `mistral:${rawItem.href}`
    if (shouldSkipExisting(externalId, existingExternalIds, stats, options)) {
      continue
    }

    const detail = await fetchMistralDetail(rawItem.href)
    const finalTitle = detail.title || rawItem.title

    await upsertNews(
      {
        title: finalTitle,
        slug: await ensureUniqueNewsSlug(finalTitle, externalId),
        published_at: detail.published_at || rawItem.published_at,
        source: 'Mistral AI',
        source_url: rawItem.href,
        external_id: externalId,
        summary: rawItem.summary,
        content: detail.content,
        content_blocks: detail.content_blocks,
        status: '已发布',
        author: detail.author || rawItem.author || 'Mistral AI',
        cover_image: detail.cover_image,
        category: rawItem.category,
      },
      stats
    )
  }

  return {
    message: 'Mistral 采集完成',
    total_found: rawItems.length,
    ...stats,
  }
}

export async function runStabilityImport(options?: ImportOptions): Promise<ImportResult> {
  const rawItems = await fetchStabilityListItems()
  const stats = buildWriteStats()
  const existingExternalIds = await getExistingExternalIds(
    rawItems.map((item) => `stability:${item.href}`)
  )

  for (const rawItem of rawItems) {
    const externalId = `stability:${rawItem.href}`
    if (shouldSkipExisting(externalId, existingExternalIds, stats, options)) {
      continue
    }

    const detail = await fetchStabilityDetail(rawItem.href)
    const finalTitle = cleanStabilityTitle(
      detail.title || rawItem.title,
      'Stability AI'
    )

    await upsertNews(
      {
        title: finalTitle,
        slug: await ensureUniqueNewsSlug(finalTitle, externalId),
        published_at: detail.published_at,
        source: 'Stability AI',
        source_url: rawItem.href,
        external_id: externalId,
        summary: 'Stability AI 官方新闻，点击查看原文。',
        content: detail.content,
        content_blocks: detail.content_blocks,
        status: '已发布',
        author: detail.author || 'Stability AI',
        cover_image: detail.cover_image,
        category: rawItem.category,
      },
      stats
    )
  }

  return {
    message: 'Stability AI 采集完成',
    total_found: rawItems.length,
    ...stats,
  }
}
