import { createClient } from '@supabase/supabase-js'
import type { AllNewsImportResult } from '@/lib/news-import/run-all'

const sourceKeys = [
  'anthropic',
  'openai',
  'deepmind',
  'meta',
  'huggingface',
  'mistral',
  'stability',
] as const

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function summarizeImportResult(result: AllNewsImportResult) {
  let totalFound = 0
  let inserted = 0
  let skipped = 0
  let errorCount = 0
  let failedSources = 0

  for (const source of sourceKeys) {
    const sourceResult = result[source]

    if (sourceResult.status !== 200) {
      failedSources += 1
      errorCount += 1
      continue
    }

    totalFound += sourceResult.result.total_found
    inserted += sourceResult.result.inserted
    skipped += sourceResult.result.skipped
    errorCount += sourceResult.result.errors.length
  }

  const status =
    failedSources === sourceKeys.length
      ? 'failed'
      : failedSources > 0 || errorCount > 0
        ? 'partial_failed'
        : 'success'

  return {
    status,
    totalFound,
    inserted,
    skipped,
    errorCount,
  }
}

export async function logImportRun({
  triggerType,
  startedAt,
  result,
}: {
  triggerType: 'cron' | 'admin'
  startedAt: Date
  result: AllNewsImportResult
}) {
  const finishedAt = new Date()
  const summary = summarizeImportResult(result)

  const { error } = await serviceSupabase.from('import_runs').insert({
    trigger_type: triggerType,
    mode: result.mode,
    status: summary.status,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_ms: finishedAt.getTime() - startedAt.getTime(),
    source_results: result,
    total_found: summary.totalFound,
    inserted: summary.inserted,
    skipped: summary.skipped,
    error_count: summary.errorCount,
  })

  if (error) {
    console.error('记录导入日志失败:', error.message)
  }
}
