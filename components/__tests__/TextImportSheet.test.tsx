import React from 'react'
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TextImportSheet } from '../TextImportSheet'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it('preserves the source, permits quantity edits and asks again about a concurrent duplicate', async () => {
  const row = {
    name: 'חלב',
    qty: '2',
    sectionId: 'milk',
    selected: true,
    repeated: false,
    negated: false,
    existing: null,
  }
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ items: [row] }))
    .mockResolvedValueOnce(
      Response.json(
        { status: 'conflict', conflicts: [{ index: 0, name: 'חלב' }] },
        { status: 409 },
      ),
    )
  vi.stubGlobal('fetch', fetcher)
  render(
    <TextImportSheet
      listId="00000000-0000-0000-0000-000000000001"
      onClose={() => {}}
      onImported={() => {}}
    />,
  )
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'שני חלב' } })
  fireEvent.click(screen.getByRole('button', { name: 'פענח רשימה' }))
  fireEvent.click(await screen.findByRole('button', { name: 'עריכת חלב' }))
  fireEvent.change(screen.getByLabelText('כמות'), { target: { value: '3' } })
  fireEvent.click(screen.getByRole('button', { name: 'סיום עריכה' }))
  fireEvent.click(screen.getByRole('button', { name: 'הוסף פריט אחד' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('הרשימה עודכנה'))
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  expect(JSON.parse(fetcher.mock.calls[1][1].body).rows[0].qty).toBe('3')
})

it('keeps the draft on extraction failure, preserves manual category on rename and requires duplicate opt-in', async () => {
  const row = {
    name: 'חלב',
    qty: null,
    sectionId: 'milk',
    selected: true,
    repeated: false,
    negated: false,
    existing: null,
  }
  const renamed = {
    ...row,
    name: 'Oatly Barista',
    selected: false,
    existing: { name: 'Oatly Barista', qty: '1' },
  }
  const fetcher = vi
    .fn()
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce(Response.json({ items: [row] }))
    .mockResolvedValueOnce(Response.json({ items: [renamed] }))
  vi.stubGlobal('fetch', fetcher)
  render(
    <TextImportSheet
      listId="00000000-0000-0000-0000-000000000001"
      onClose={() => {}}
      onImported={() => {}}
    />,
  )
  const source = screen.getByRole('textbox') as HTMLTextAreaElement
  expect(source).toBe(document.activeElement)
  fireEvent.change(source, { target: { value: 'חלב' } })
  fireEvent.click(screen.getByText('פענח רשימה'))
  await screen.findByRole('alert')
  expect(source.value).toBe('חלב')
  fireEvent.click(screen.getByText('פענח רשימה'))
  fireEvent.click(await screen.findByRole('button', { name: 'עריכת חלב' }))
  fireEvent.change(screen.getByLabelText('שם הפריט'), { target: { value: 'Oatly Barista' } })
  fireEvent.change(screen.getByLabelText('קטגוריה'), { target: { value: 'drinks' } })
  fireEvent.click(screen.getByText('סיום עריכה'))
  const check = await screen.findByRole('checkbox', { name: 'הוסף Oatly Barista' })
  expect((check as HTMLInputElement).checked).toBe(false)
  expect(screen.getByText('משקאות')).toBeTruthy()
  expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({ name: 'Oatly Barista' })
  fireEvent.click(check)
  expect(screen.getByText('יתווסף כפריט נוסף')).toBeTruthy()
})
