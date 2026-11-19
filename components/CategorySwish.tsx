'use client'

import { useLayoutEffect, useRef, useState } from 'react'

export function CategorySwish({ expiresAt }: { expiresAt: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [duration] = useState(() => Math.max(0, expiresAt - Date.now()))
  useLayoutEffect(() => {
    const rect = ref.current?.getBoundingClientRect()
    setVisible(Boolean(rect && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth && expiresAt > Date.now()))
  }, [expiresAt])
  return <span ref={ref} aria-hidden="true" className="category-swish"
    style={{ visibility: visible ? 'visible' : 'hidden', animationDuration: `${duration}ms` }}>
    <span className="category-swish-trail" />
    <span className="category-swish-star" />
    <span className="category-swish-star" />
    <span className="category-swish-star" />
  </span>
}
