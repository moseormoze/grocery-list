'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ListPlus, Pencil, X } from 'lucide-react'
import { SECTIONS_BY_TYPE } from '@/lib/categories'
import { isCategory } from '@/lib/categorization/types'
import type { Item } from '@/lib/db/types'
import { normalizedName } from '@/lib/text-import/preview'
import { getReview, type ReviewItem } from '@/lib/text-import/review-client'
import { createImportConfirmation } from '@/lib/text-import/confirm-client'
import messages from '@/messages/he.json'

const t = messages.textImport
const departments = SECTIONS_BY_TYPE.supermarket
type Props = { listId: string; onClose: () => void; onImported: (items: Item[], retried: boolean) => void }

export function TextImportSheet({ listId, onClose, onImported }: Props) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<ReviewItem[] | null>(null)
  const [edit, setEdit] = useState<{ index: number; row: ReviewItem } | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [changed, setChanged] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const request = useRef<AbortController | null>(null)
  const confirmation = useRef<ReturnType<typeof createImportConfirmation> | null>(null)
  const saving = useRef(false)
  const mounted = useRef(false)
  const selected = (rows ?? []).filter((r) => r.selected)
  const count = selected.length

  useEffect(() => {
    mounted.current = true
    const el = dialog.current
    const opener = document.activeElement
    if (el?.showModal) el.showModal()
    else el?.setAttribute('open', '')
    input.current?.focus()
    const viewport = window.visualViewport
    function positionAboveKeyboard() {
      if (!viewport || !el) return
      const bottom = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      el.style.setProperty('--import-bottom', bottom + 'px')
      el.style.setProperty('--import-height', Math.floor(viewport.height * 0.92) + 'px')
    }
    positionAboveKeyboard()
    viewport?.addEventListener('resize', positionAboveKeyboard)
    viewport?.addEventListener('scroll', positionAboveKeyboard)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      viewport?.removeEventListener('resize', positionAboveKeyboard)
      viewport?.removeEventListener('scroll', positionAboveKeyboard)
      mounted.current = false
      request.current?.abort()
      if (el?.open) el.close?.()
      document.body.style.overflow = overflow
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  function close() {
    if (!saving.current && (!text.trim() || window.confirm(t.discard))) onClose()
  }
  function change(next: ReviewItem[]) {
    confirmation.current = null
    setChanged(true)
    setError('')
    setRows(next)
  }
  async function preview(name?: string) {
    if (request.current) return
    const controller = new AbortController()
    request.current = controller
    setBusy(name ? t.checking : t.parsing)
    setError('')
    try {
      const result = await getReview(listId, name ? { name } : { text }, controller.signal)
      if (controller.signal.aborted) return
      if (name && edit) {
        if (!result[0]) throw new Error('Missing name')
        applyEdit(result[0])
      } else if (result.length) {
        setRows(result)
        setChanged(false)
        requestAnimationFrame(() => title.current?.focus())
      } else setError(t.empty)
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          !navigator.onLine
            ? t.offline
            : e instanceof Error && e.message === '413'
              ? t.tooLong
              : t.error,
        )
    } finally {
      request.current = null
      if (mounted.current) setBusy('')
    }
  }
  function applyEdit(lookup?: ReviewItem) {
    if (!rows || !edit) return
    const edited = { ...edit.row, name: edit.row.name.trim(), qty: edit.row.qty?.trim() || null }
    if (lookup) {
      edited.existing = lookup.existing
      if (edited.mode === 'auto') edited.sectionId = lookup.sectionId
      if (lookup.existing) edited.selected = false
    }
    const seen = new Set<string>()
    const next = rows.map((prev, i) => {
      const row = i === edit.index ? edited : prev
      const name = normalizedName(row.name)
      const repeated = seen.has(name)
      seen.add(name)
      return {
        ...row,
        repeated,
        selected: row.selected && !(repeated && (!prev.repeated || (i === edit.index && lookup))),
      }
    })
    change(next)
    setEdit(null)
    const index = edit.index
    requestAnimationFrame(() =>
      dialog.current
        ?.querySelector<HTMLButtonElement>('[data-edit-index="' + index + '"]')
        ?.focus(),
    )
  }
  async function submit() {
    if (saving.current || !rows || !count) return
    saving.current = true
    setBusy(t.saving)
    setError('')
    try {
      const retried = confirmation.current !== null
      confirmation.current ??= createImportConfirmation(
        listId,
        selected.map((r) => ({
          name: r.name,
          qty: r.qty,
          sectionId: r.sectionId,
          mode: r.mode,
          duplicateFor: r.existing || r.repeated ? normalizedName(r.name) : null,
        })),
      )
      const result = await confirmation.current.submit()
      if (!mounted.current) return
      if (result.status === 'saved') {
        onImported(result.items, retried)
        return
      }
      const conflicts = new Set(result.conflicts.map((c) => selected[c.index]))
      change(
        rows.map((r) =>
          conflicts.has(r)
            ? { ...r, selected: false, existing: r.existing ?? { name: r.name, qty: null } }
            : r,
        ),
      )
      setError(t.refresh)
    } catch {
      if (mounted.current) setError(t.saveError)
    } finally {
      saving.current = false
      if (mounted.current) setBusy('')
    }
  }
  return (
    <dialog
      ref={dialog}
      className="import-sheet"
      aria-labelledby="import-title"
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div className="import-handle" aria-hidden="true" />
      <header className="px-5 py-3 flex justify-between gap-2 items-start">
        <div>
          <h2 ref={title} id="import-title" tabIndex={-1} className="text-2xl font-bold">
            {rows ? t.review : t.title}
          </h2>
          <p className="text-sm text-ink-70 mt-1">
            {!rows
              ? t.instruction
              : count === 1
                ? t.oneSelected
                : count
                  ? t.included.replace('{count}', String(count))
                  : t.noneSelected}
          </p>
        </div>
        <button
          className="icon-btn"
          aria-label={t.close}
          disabled={busy === t.saving}
          onClick={close}
        >
          <X size={20} />
        </button>
      </header>
      <div className="import-body">
        {!rows ? (
          <>
            <label htmlFor="shopping-text" className="block text-sm font-semibold mb-2">
              {t.label}
            </label>
            <textarea
              id="shopping-text"
              ref={input}
              dir="auto"
              className="input import-input"
              placeholder={t.placeholder}
              value={text}
              disabled={!!busy}
              onChange={(e) => {
                setText(e.target.value)
                setError('')
              }}
            />
            <p className="text-xs text-ink-70 flex gap-2 items-center mt-3">
              <Check size={16} />
              {t.hint}
            </p>
          </>
        ) : (
          <>
            {rows.map((r, i) => {
              const category = departments[r.sectionId]
              const flagged = r.existing || r.repeated || r.negated
              const reason =
                r.selected && flagged
                  ? r.existing || r.repeated
                    ? t.extra
                    : t.override
                  : r.existing
                    ? t.duplicate
                    : r.repeated
                      ? t.repeat
                      : r.negated
                        ? t.excluded
                        : ''
              return (
                <article className="import-row" key={i}>
                  <div className="flex gap-1 items-center">
                    <label className="import-check">
                      <input
                        type="checkbox"
                        checked={r.selected}
                        disabled={!!busy || !!edit}
                        aria-label={t.select.replace('{name}', r.name)}
                        onChange={() =>
                          change(
                            rows.map((v, j) => (i === j ? { ...v, selected: !v.selected } : v)),
                          )
                        }
                      />
                    </label>
                    <div className="flex-1 min-w-0">
                      <strong dir="auto" className="block break-words">
                        {r.name}
                      </strong>
                      {r.qty && (
                        <small dir="auto" className="block text-ink-70">
                          {r.qty}
                        </small>
                      )}
                      <div className="flex gap-2 items-center flex-wrap mt-1">
                        <span
                          className="import-chip"
                          style={{ background: category.tint, color: category.ink }}
                        >
                          {category.name}
                        </span>
                        {reason && <small>{reason}</small>}
                      </div>
                      {r.existing?.qty && (
                        <small className="block">
                          {t.existing.replace('{qty}', r.existing.qty)}
                        </small>
                      )}
                    </div>
                    <button
                      className="icon-btn"
                      data-edit-index={i}
                      disabled={!!busy || !!edit}
                      aria-label={t.edit.replace('{name}', r.name)}
                      onClick={() => {
                        setError('')
                        setEdit({ index: i, row: { ...r } })
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                  </div>
                  {edit?.index === i && (
                    <fieldset disabled={!!busy} className="grid gap-2 p-2 border-t mt-2">
                      <label>
                        {t.name}
                        <input
                          autoFocus
                          required
                          aria-invalid={!edit.row.name.trim()}
                          dir="auto"
                          className="input"
                          maxLength={500}
                          value={edit.row.name}
                          onChange={(e) =>
                            setEdit({ ...edit, row: { ...edit.row, name: e.target.value } })
                          }
                        />
                      </label>
                      {!edit.row.name.trim() && <small role="alert">{t.emptyName}</small>}
                      <label>
                        {t.qty}
                        <input
                          dir="auto"
                          className="input"
                          maxLength={200}
                          value={edit.row.qty ?? ''}
                          onChange={(e) =>
                            setEdit({ ...edit, row: { ...edit.row, qty: e.target.value } })
                          }
                        />
                      </label>
                      <label>
                        {t.category}
                        <select
                          className="input"
                          value={edit.row.sectionId}
                          onChange={(e) => {
                            const sectionId = e.target.value
                            if (isCategory(sectionId))
                              setEdit({ ...edit, row: { ...edit.row, sectionId, mode: 'manual' } })
                          }}
                        >
                          {Object.entries(departments).map(([id, c]) => (
                            <option value={id} key={id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="btn btn-soft"
                        disabled={!edit.row.name.trim()}
                        onClick={() => {
                          if (normalizedName(edit.row.name) !== normalizedName(r.name))
                            void preview(edit.row.name.trim())
                          else applyEdit()
                        }}
                      >
                        {t.apply}
                      </button>
                    </fieldset>
                  )}
                </article>
              )
            })}
            <details>
              <summary className="py-3 cursor-pointer">{t.source}</summary>
              <p dir="auto" className="whitespace-pre-wrap">
                {text}
              </p>
            </details>
          </>
        )}
      </div>
      <footer className="import-footer">
        {error && (
          <p role="alert" className="pb-2 text-sm">
            {error}
          </p>
        )}
        <div role="status" className="sr-only">
          {busy}
        </div>
        <button
          className="btn btn-accent w-full"
          disabled={!!busy || (rows ? !count || !!edit : !text.trim())}
          onClick={() => (rows ? void submit() : void preview())}
        >
          {!rows && <ListPlus size={18} />}
          {busy ||
            (rows ? (count === 1 ? t.one : t.add.replace('{count}', String(count))) : t.parse)}
        </button>
        {rows && (
          <button
            className="btn btn-ghost w-full"
            disabled={!!busy}
            onClick={() => {
              if ((!changed && !edit) || window.confirm(t.replace)) {
                setRows(null)
                setEdit(null)
                confirmation.current = null
                setError('')
                requestAnimationFrame(() => input.current?.focus())
              }
            }}
          >
            <ArrowRight size={16} />
            {t.back}
          </button>
        )}
      </footer>
    </dialog>
  )
}
