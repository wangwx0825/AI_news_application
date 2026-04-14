import type { ReactNode } from 'react'

interface InfoCardItem {
  label: string
  value: ReactNode
}

interface InfoCardProps {
  title: string
  items: InfoCardItem[]
}

export default function InfoCard({ title, items }: InfoCardProps) {
  return (
    <div className="bg-card border border-border rounded-md overflow-hidden md:sticky md:top-5">
      <div className="bg-sec-bg px-4 py-3.5 text-center font-bold text-base border-b border-border">
        {title}
      </div>
      {items.map((item, i) => (
        <div
          key={i}
          className="flex px-4 py-2 text-[13px] border-b border-sec-bg last:border-b-0"
        >
          <div className="w-[72px] shrink-0 text-label font-medium">{item.label}</div>
          <div className="text-text">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
