import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { CategorySwish } from '../CategorySwish'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
describe('cosmic feedback visibility', () => {
  it('is decorative, does not replay on rerender, and skips offscreen rows', () => {
    const rect = { x: 0, y: 10000, top: 10000, left: 0, bottom: 10050, right: 375, width: 375, height: 50, toJSON: () => ({}) }
    const bounds = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(rect)
    const expiresAt = Date.now() + 500
    const view = render(<CategorySwish expiresAt={expiresAt} />)
    const swish = view.container.firstElementChild as HTMLElement
    expect(swish.getAttribute('aria-hidden')).toBe('true')
    expect(swish.style.visibility).toBe('hidden')
    bounds.mockReturnValue({ ...rect, top: 40, bottom: 90 })
    view.rerender(<CategorySwish expiresAt={expiresAt} />)
    expect(swish.style.visibility).toBe('hidden')
  })
  it('does not show an expired effect', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 50, left: 0, right: 375 } as DOMRect)
    const view = render(<CategorySwish expiresAt={Date.now() - 10} />)
    expect((view.container.firstElementChild as HTMLElement).style.visibility).toBe('hidden')
  })
})
