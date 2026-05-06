import type {
  ImportOptions,
  ImportResult,
  ImportRunner,
} from '@/lib/news-import/importers'

const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_MAX_ATTEMPTS = 2

type ScheduledImportOptions = {
  name: string
  runner: ImportRunner
  importOptions?: ImportOptions
  timeoutMs?: number
  maxAttempts?: number
}

type ScheduledImportSuccess = {
  status: 200
  attempts: number
  duration_ms: number
  result: ImportResult
}

type ScheduledImportFailure = {
  status: 500
  attempts: number
  duration_ms: number
  result: {
    error: string
  }
}

export type ScheduledImportResult =
  | ScheduledImportSuccess
  | ScheduledImportFailure

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '未知错误'
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, name: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${name} 导入超过 ${Math.round(timeoutMs / 1000)} 秒`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function runScheduledImport({
  name,
  runner,
  importOptions,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
}: ScheduledImportOptions): Promise<ScheduledImportResult> {
  const startedAt = Date.now()
  let lastError = ''

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await withTimeout(runner(importOptions), timeoutMs, name)
      return {
        status: 200,
        attempts: attempt,
        duration_ms: Date.now() - startedAt,
        result,
      }
    } catch (error) {
      lastError = getErrorMessage(error)
      console.error(`${name} import attempt ${attempt} failed:`, lastError)
    }
  }

  return {
    status: 500,
    attempts: maxAttempts,
    duration_ms: Date.now() - startedAt,
    result: {
      error: lastError || `${name} 导入失败`,
    },
  }
}
