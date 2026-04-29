import type { ReactNode } from 'react'
import Breadcrumb from './Breadcrumb'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface EntryLayoutProps {
  breadcrumbItems: BreadcrumbItem[]
  title: string
  infoCard: ReactNode
  children: ReactNode
}

export default function EntryLayout({ breadcrumbItems, title, infoCard, children }: EntryLayoutProps) {
  return (
    <>
      <Breadcrumb items={breadcrumbItems} />
      <h1 className="font-serif text-[22px] sm:text-[28px] font-bold py-1.5 border-b border-border mb-4">
        {title}
      </h1>
      <div className="flex border-b border-border mb-4">
        <div className="px-4 py-1.5 text-[13px] text-text border-b-2 border-link font-medium">
          词条
        </div>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0">{children}</div>
        <div className="order-first md:order-none">{infoCard}</div>
      </div>
    </>
  )
}
