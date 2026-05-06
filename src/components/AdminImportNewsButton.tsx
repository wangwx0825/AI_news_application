'use client'

import { useState } from 'react'

type ImportResponse = {
  mode?: string
  [source: string]: unknown
}

export default function AdminImportNewsButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  async function handleFullRefresh() {
    const confirmed = window.confirm(
      '强制重抓会重新抓取所有来源的旧新闻正文、图片和视频，耗时会比日常同步更久。确定继续吗？'
    )

    if (!confirmed) return

    setLoading(true)
    setMessage('')
    setErrorMessage('')

    try {
      const response = await fetch('/api/admin/import-all-news?refresh=1', {
        method: 'POST',
      })
      const data = (await response.json()) as ImportResponse

      if (!response.ok) {
        throw new Error(
          typeof data.error === 'string' ? data.error : '强制重抓失败'
        )
      }

      setMessage('强制重抓已完成，可以刷新新闻列表查看结果。')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '强制重抓失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-white/80 p-6 shadow-lg">
      <div className="text-xl font-semibold text-text">采集工具</div>
      <p className="mt-2 text-sm leading-7 text-sub">
        日常采集默认只抓新新闻；当解析规则更新后，可以强制重抓旧新闻以刷新正文、图片和视频。
      </p>

      <button
        type="button"
        onClick={handleFullRefresh}
        disabled={loading}
        className="mt-4 rounded-lg bg-text px-4 py-2 text-sm text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? '正在强制重抓...' : '强制重抓全部新闻'}
      </button>

      {message ? (
        <p className="mt-3 text-sm text-green-700">{message}</p>
      ) : null}
      {errorMessage ? (
        <p className="mt-3 text-sm text-red-600">执行失败：{errorMessage}</p>
      ) : null}
    </div>
  )
}
