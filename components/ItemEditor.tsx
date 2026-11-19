'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Item } from '@/lib/db/types'
import { LIST_TYPE_META, type ListType } from '@/lib/list-types'
import { SECTIONS_BY_TYPE } from '@/lib/categories'
import { saveListItem } from '@/lib/categorization/client'
import type { CategoryMode, SaveResult } from '@/lib/categorization/types'
import messages from '@/messages/he.json'

type Props = { listId: string, listType: ListType, item: Item | null, orderIndex: number, onSaved: (result: SaveResult) => void, onClose: () => void }
const t = messages.items

export function ItemEditor({ listId, listType, item, orderIndex, onSaved, onClose }: Props) {
  const [name, setName] = useState(item?.name ?? '')
  const [qty, setQty] = useState(item?.qty ?? '')
  const [section, setSection] = useState(item?.section_id ?? (listType === 'supermarket' ? 'auto' : 'other'))
  const [intent, setIntent] = useState<CategoryMode>(item ? 'preserve' : listType === 'supermarket' ? 'auto' : 'manual')
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState(false)
  const locked = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const nameInput = useRef<HTMLInputElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()
  const mounted = useRef(true)
  const [opener] = useState(() => typeof document === 'undefined' ? null : document.activeElement)
  const typeInfo = LIST_TYPE_META[listType]

  useEffect(() => {
    mounted.current = true
    nameInput.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      mounted.current = false
      clearTimeout(closeTimer.current)
      document.body.style.overflow = previousOverflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [opener])

  function close(result?: SaveResult) {
    locked.current = true
    setClosing(true)
    const duration = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 150
    closeTimer.current = setTimeout(() => {
      if (result) onSaved(result)
      onClose()
    }, duration)
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (locked.current || !name.trim()) return
    locked.current = true
    setSaving(true)
    setError(false)
    try {
      const result = await saveListItem({ listId, itemId: item?.id, name, qty, mode: intent, sectionId: section }, listType, orderIndex)
      if (mounted.current) close(result)
    } catch {
      if (mounted.current) {
        locked.current = false
        setSaving(false)
        setError(true)
      }
    }
  }
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      if (!locked.current) close()
    }
    if (event.key === 'Tab') {
      const controls = Array.from(form.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])
      if (!controls.length) { event.preventDefault(); return }
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }
  return (
    <div className={`fixed inset-0 bg-black/40 flex items-end z-50 item-sheet-backdrop ${closing ? 'item-sheet-closing' : ''}`}>
      <form ref={form} onSubmit={submit} aria-label={item ? t.editItem : t.addItem}
        className="w-full bg-cream rounded-t-3xl shadow-sheet max-h-[85dvh] overflow-y-auto item-sheet"
        aria-busy={saving}>
        <div role="dialog" aria-modal="true" aria-labelledby="item-editor-title" onKeyDown={onKeyDown}>
          <fieldset disabled={saving || closing}>
            <div className="flex items-center justify-between p-5 border-b border-ink-06 gap-2">
              <button type="button" onClick={() => { if (!locked.current) close() }} className="btn btn-ghost text-sm">{messages.lists.cancel}</button>
              <h2 id="item-editor-title" className="text-lg font-bold flex-1 text-center">{item ? t.editItem : t.addItem}</h2>
              <button type="submit" disabled={!name.trim() || saving || closing} className="btn btn-accent text-sm">
                {saving ? t.saving : item ? t.update : t.add}
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="item-name" className="text-xs font-bold text-ink-70">{t.itemName}</label>
                <input ref={nameInput} id="item-name" value={name} onChange={event => setName(event.target.value)}
                  placeholder={typeInfo.itemNamePlaceholder} className="input" dir="auto" maxLength={500} required />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="item-qty" className="text-xs font-bold text-ink-70">{t.itemQty}</label>
                <input id="item-qty" value={qty} onChange={event => setQty(event.target.value)}
                  placeholder={typeInfo.itemQtyPlaceholder} className="input" dir="auto" maxLength={200} />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="item-section" className="text-xs font-bold text-ink-70">{t.category}</label>
                <div className="item-category-control">
                  <select id="item-section" value={section} className="input item-category-select" onChange={event => {
                    setSection(event.target.value)
                    setIntent(event.target.value === 'auto' ? 'auto' : 'manual')
                  }}>
                    {listType === 'supermarket' && <option value="auto">{t.autoCategory}</option>}
                    {Object.entries(SECTIONS_BY_TYPE[listType]).map(([key, category]) => (
                      <option key={key} value={key}>{category.emoji} {category.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={18} aria-hidden="true" className="item-category-chevron" />
                </div>
              </div>
              {error && <p role="alert" className="text-sm text-danger">{t.saveError}</p>}
            </div>
          </fieldset>
          <span className="sr-only" role="status">{saving ? t.saving : ''}</span>
        </div>
      </form>
    </div>
  )
}
