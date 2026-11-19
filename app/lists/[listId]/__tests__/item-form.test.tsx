import React from 'react'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ListDetailPage from '../page'
import type { Item } from '@/lib/db/types'
const mock = vi.hoisted(() => ({ save: vi.fn(), update: vi.fn(), items: [] as Item[] }))
vi.mock('next/navigation', () => ({ useParams: () => ({ listId: 'l' }), useRouter: () => ({ back: vi.fn() }) }))
vi.mock('@/lib/supabase/client', () => ({ supabase: {} }))
vi.mock('@/lib/categorization/client', () => ({ saveListItem: mock.save }))
vi.mock('@/hooks/useList', () => ({ useList: () => ({ list: { id: 'l', name: 'סופר', type: 'supermarket' }, items: mock.items, loading: false, error: null, updateOptimistically: mock.update, deleteOptimistically: vi.fn(), reorderOptimistically: vi.fn() }) }))
const item: Item = { id: 'i', list_id: 'l', name: 'סקיר', section_id: 'milk', ticked: false, order_index: 0, created_by_user_id: 'u', created_at: 'now', updated_at: 'now' }
beforeEach(() => {
  vi.resetAllMocks()
  mock.items = []
  mock.update.mockImplementation((saved: Item) => { mock.items = [saved] })
  mock.save.mockResolvedValue({ item, source: 'remembered' })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 40, top: 40, left: 0, bottom: 90, right: 375, width: 375, height: 50, toJSON: () => ({}) })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })
async function add() {
  fireEvent.click(screen.getByRole('button', { name: '+ הוסף פריט' }))
  fireEvent.change(screen.getByLabelText('שם הפריט'), { target: { value: 'סקיר' } })
  fireEvent.click(screen.getByRole('button', { name: 'הוסף' }))
  await waitFor(() => expect(mock.update).toHaveBeenCalledWith(item))
}
describe('list categorization integration', () => {
  it('adds with auto and shows success once without delaying the next add', async () => {
    const view = render(<ListDetailPage />)
    await add()
    expect(mock.save.mock.calls[0][0].mode).toBe('auto')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.querySelector('.category-swish')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '+ הוסף פריט' }))
    expect(screen.getByLabelText('קטגוריה')).toHaveValue('auto')
    expect(screen.getByLabelText('שם הפריט')).toHaveValue('')
    await waitFor(() => expect(document.querySelector('.category-swish')).toBeNull())
    view.rerender(<ListDetailPage />)
    expect(document.querySelector('.category-swish')).toBeNull()
  })
  it('does not celebrate fallback', async () => {
    mock.save.mockResolvedValue({ item, source: 'fallback' })
    render(<ListDetailPage />)
    await add()
    expect(document.querySelector('.category-swish')).toBeNull()
  })
  it('does not celebrate existing items or realtime rerenders', () => {
    mock.items = [item]
    const view = render(<ListDetailPage />)
    view.rerender(<ListDetailPage />)
    expect(document.querySelector('.category-swish')).toBeNull()
  })
})
