import Link from 'next/link'
import AdminEntryButton from '@/components/AdminEntryButton'

export default function Header() {
  return (
    <div className="flex items-center justify-between border-b border-border py-4">
      <Link
        href="/"
        className="flex items-center gap-1.5 font-serif text-xl font-bold !text-text !no-underline transition duration-300 hover:scale-105"
      >
        Company<span className="text-accent">Wiki</span>
      </Link>

      <Link
        href="/news"
        className="inline-block text-sm text-sub transition duration-300 hover:scale-110 hover:text-link"
      >
        新闻
      </Link>

      <Link
        href="/faq"
        className="inline-block text-link transition duration-300 hover:scale-110 hover:underline"
      >
        FAQ
      </Link>

      <AdminEntryButton />
    </div>
  )
}