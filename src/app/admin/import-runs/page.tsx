import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'

type ImportRun = {
  id: string
  trigger_type: string
  mode: string
  status: string
  started_at: string
  finished_at: string
  duration_ms: number
  source_results: Record<string, unknown>
  total_found: number
  inserted: number
  skipped: number
  error_count: number
}

const sourceLabels: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  deepmind: 'DeepMind',
  meta: 'Meta AI',
  huggingface: 'Hugging Face',
  mistral: 'Mistral AI',
  stability: 'Stability AI',
}

function statusLabel(status: string) {
  if (status === 'success') return '成功'
  if (status === 'partial_failed') return '部分失败'
  if (status === 'failed') return '失败'
  return status || '未知'
}

function statusClassName(status: string) {
  if (status === 'success') return 'bg-green-50 text-green-700'
  if (status === 'partial_failed') return 'bg-amber-50 text-amber-700'
  return 'bg-red-50 text-red-700'
}

function modeLabel(mode: string) {
  return mode === 'full_refresh' ? '强制重抓' : '增量同步'
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs}ms`
  return `${(durationMs / 1000).toFixed(1)}s`
}

function getSourceSummary(run: ImportRun, source: string) {
  const sourceResult = run.source_results?.[source] as
    | {
        status?: number
        duration_ms?: number
        result?: {
          inserted?: number
          skipped?: number
          errors?: unknown[]
          error?: string
        }
      }
    | undefined

  if (!sourceResult) return '暂无'
  if (sourceResult.status !== 200) {
    return `失败：${sourceResult.result?.error || '未知错误'}`
  }

  const result = sourceResult.result
  return `新增 ${result?.inserted ?? 0} / 跳过 ${result?.skipped ?? 0} / 错误 ${
    result?.errors?.length ?? 0
  }`
}

export default async function AdminImportRunsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('email')
    .eq('email', user.email)
    .single()

  if (!adminUser) {
    redirect('/')
  }

  const { data: runs, error } = await supabase
    .from('import_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">采集日志</h1>
          <p className="mt-2 text-sm text-sub">
            查看最近 20 次新闻采集的状态、耗时和各来源结果。
          </p>
        </div>

        <a
          href="/admin"
          className="inline-block text-sm text-link transition duration-300 hover:scale-110 hover:underline"
        >
          ← 返回后台首页
        </a>
      </div>

      {error ? (
        <div className="rounded-2xl border border-border bg-white/80 p-6 shadow-lg">
          <p className="text-red-600">读取采集日志失败：{error.message}</p>
          <p className="mt-3 text-sm leading-7 text-sub">
            如果这是第一次使用，请先在 Supabase SQL Editor 运行
            <code className="mx-1 rounded bg-white px-1.5 py-0.5">
              supabase/import-runs.sql
            </code>
            里的 SQL。
          </p>
        </div>
      ) : runs?.length ? (
        <div className="space-y-4">
          {(runs as ImportRun[]).map((run) => (
            <section
              key={run.id}
              className="rounded-2xl border border-border bg-white/80 p-5 shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(
                        run.status
                      )}`}
                    >
                      {statusLabel(run.status)}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs text-sub">
                      {modeLabel(run.mode)}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs text-sub">
                      {run.trigger_type === 'admin' ? '后台触发' : '定时触发'}
                    </span>
                  </div>

                  <div className="mt-3 text-sm text-sub">
                    {new Date(run.started_at).toLocaleString('zh-CN')} · 耗时{' '}
                    {formatDuration(run.duration_ms)}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 text-center text-sm">
                  <div>
                    <div className="font-semibold text-text">{run.total_found}</div>
                    <div className="text-xs text-sub">发现</div>
                  </div>
                  <div>
                    <div className="font-semibold text-text">{run.inserted}</div>
                    <div className="text-xs text-sub">新增</div>
                  </div>
                  <div>
                    <div className="font-semibold text-text">{run.skipped}</div>
                    <div className="text-xs text-sub">跳过</div>
                  </div>
                  <div>
                    <div className="font-semibold text-text">{run.error_count}</div>
                    <div className="text-xs text-sub">错误</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {Object.entries(sourceLabels).map(([source, label]) => (
                  <div
                    key={source}
                    className="rounded-xl border border-border/70 bg-white/60 px-4 py-3 text-sm"
                  >
                    <div className="font-semibold text-text">{label}</div>
                    <div className="mt-1 text-sub">{getSourceSummary(run, source)}</div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-white/80 p-6 text-sub shadow-lg">
          暂无采集日志。下一次执行新闻采集后，这里会显示记录。
        </div>
      )}
    </main>
  )
}
