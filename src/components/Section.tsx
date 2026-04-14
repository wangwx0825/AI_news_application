import type { ReactNode } from 'react'

interface SectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export default function Section({ title, defaultOpen = false, children }: SectionProps) {
  return (
    <details className="border-b border-border group" open={defaultOpen || undefined}>
      <summary className="flex items-center gap-2 py-3.5 select-none font-serif text-lg font-bold transition-colors hover:text-link active:bg-sec-bg touch-manipulation cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="text-xs text-hint transition-transform duration-250 inline-block w-4 group-open:rotate-90">
          ▶
        </span>
        {title}
      </summary>
      <div className="pb-4 pl-6 text-sm leading-[1.8] text-sub">
        {children}
      </div>
    </details>
  )
}
