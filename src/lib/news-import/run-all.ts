import {
  runAnthropicImport,
  runDeepMindImport,
  runHuggingFaceImport,
  runMetaImport,
  runMistralImport,
  runOpenAIImport,
  runStabilityImport,
} from '@/lib/news-import/importers'
import {
  runScheduledImport,
  type ScheduledImportResult,
} from '@/lib/news-import/scheduled-runner'

export type AllNewsImportResult = {
  message: string
  mode: 'incremental' | 'full_refresh'
  anthropic: ScheduledImportResult
  openai: ScheduledImportResult
  deepmind: ScheduledImportResult
  meta: ScheduledImportResult
  huggingface: ScheduledImportResult
  mistral: ScheduledImportResult
  stability: ScheduledImportResult
}

export async function runAllNewsImports(refreshExisting = false) {
  const importOptions = refreshExisting ? { refreshExisting: true } : undefined

  const [
    anthropic,
    openai,
    deepmind,
    meta,
    huggingface,
    mistral,
    stability,
  ] = await Promise.all([
    runScheduledImport({ name: 'Anthropic', runner: runAnthropicImport, importOptions }),
    runScheduledImport({ name: 'OpenAI', runner: runOpenAIImport, importOptions }),
    runScheduledImport({ name: 'Google DeepMind', runner: runDeepMindImport, importOptions }),
    runScheduledImport({ name: 'Meta AI', runner: runMetaImport, importOptions }),
    runScheduledImport({ name: 'Hugging Face', runner: runHuggingFaceImport, importOptions }),
    runScheduledImport({ name: 'Mistral AI', runner: runMistralImport, importOptions }),
    runScheduledImport({ name: 'Stability AI', runner: runStabilityImport, importOptions }),
  ])

  return {
    message: '全部新闻采集完成',
    mode: refreshExisting ? 'full_refresh' : 'incremental',
    anthropic,
    openai,
    deepmind,
    meta,
    huggingface,
    mistral,
    stability,
  } satisfies AllNewsImportResult
}
