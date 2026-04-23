'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export default function Header() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <header className="border-b border-border py-5">
      <div className="mx-auto max-w-[1180px] px-4 sm:px-6 lg:px-8">
        <div className="flex justify-start">
          <div
            ref={wrapperRef}
            className="relative inline-block"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="flex items-center gap-2 font-serif text-[36px] font-bold text-text transition duration-300 hover:scale-[1.02] sm:text-[42px]"
            >
              <span>
                Company<span className="text-accent"> Wiki</span>
              </span>
              <span
                className={`text-base transition duration-200 ${
                  open ? 'rotate-180' : ''
                }`}
              >
                ▾
              </span>
            </button>

            {open ? (
              <div className="absolute left-0 top-full z-50 pt-2">
                <div className="w-44 overflow-hidden rounded-2xl border border-white/60 bg-white/90 shadow-xl backdrop-blur-md">
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 text-sm text-text no-underline transition hover:bg-white hover:text-link"
                  >
                    首页
                  </Link>

                  <Link
                    href="/faq"
                    onClick={() => setOpen(false)}
                    className="block border-t border-border px-4 py-3 text-sm text-text no-underline transition hover:bg-white hover:text-link"
                  >
                    常见问题
                  </Link>

                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="block border-t border-border px-4 py-3 text-sm text-text no-underline transition hover:bg-white hover:text-link"
                  >
                    后台管理
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  )
}