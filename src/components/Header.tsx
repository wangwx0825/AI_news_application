import Link from 'next/link'

export default function Header() {
  return (
    <div className="border-b border-border py-4 flex items-center justify-between">
      <Link
        href="/"
        className="font-serif text-xl font-bold !text-text !no-underline flex items-center gap-1.5"
      >
        Company<span className="text-accent">Wiki</span>
      </Link>
      <Link href="/demo" className="text-sm text-sub hover:text-link">
        示例页面
      </Link>
    </div>
  )
}
