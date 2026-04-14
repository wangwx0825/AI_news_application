import Link from 'next/link'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <div className="py-2.5 text-[13px] text-hint">
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && <span className="mx-1.5">›</span>}
          {item.href ? (
            <Link href={item.href} className="text-link hover:underline">
              {item.label}
            </Link>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </div>
  )
}
