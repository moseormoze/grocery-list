import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Item, List } from '@/lib/db/types';
import ListDetailPage from '../page';

const mock = vi.hoisted(() => ({
  listId: 'list-a', list: null as List | null, items: [] as Item[], loading: false,
  error: null as string | null, writeText: vi.fn(), from: vi.fn(),
  update: vi.fn(), remove: vi.fn(), reorder: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useParams: () => ({ listId: mock.listId }), useRouter: () => ({ back: vi.fn() }) }));
vi.mock('@/lib/supabase/client', () => ({ supabase: { from: mock.from } }));
vi.mock('@/hooks/useList', () => ({ useList: () => ({
  list: mock.list, items: mock.items, loading: mock.loading, error: mock.error,
  updateOptimistically: mock.update, deleteOptimistically: mock.remove, reorderOptimistically: mock.reorder,
}) }));
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const success = 'הרשימה הועתקה';
const empty = 'אין פריטים לקנייה';
const failure = 'לא הצלחנו להעתיק. נסו שוב';
const copyButton = () => screen.getByRole('button', { name: 'העתק רשימה' });
const expectMessage = (text: string) => expect(screen.getAllByText(text).length).toBeGreaterThan(0);
const expectNoMessage = (text: string) => expect(screen.queryAllByText(text)).toHaveLength(0);
const item = (id: string, name: string, section_id = 'milk', ticked = false): Item => ({
  id, name, section_id, ticked, list_id: mock.listId, order_index: 0,
  created_by_user_id: 'user', created_at: 'now', updated_at: 'now',
});
function pendingWrite() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
  mock.writeText.mockReturnValueOnce(promise);
  return { resolve, reject };
}
async function copy() { await act(async () => { fireEvent.click(copyButton()); }); }
beforeEach(() => {
  vi.resetAllMocks();
  mock.listId = 'list-a';
  mock.list = { id: mock.listId, name: 'קניות', type: 'supermarket', household_id: 'home', created_at: 'now', updated_at: 'now' };
  mock.items = [{ ...item('milk', 'חלב 3%'), qty: '2 קרטונים' }];
  mock.loading = false;
  mock.error = null;
  mock.writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mock.writeText } });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
  else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('copy list integration', () => {
  it('copies in displayed category order without changing items, including in edit mode', async () => {
    mock.items = [item('done', 'בננות', 'produce', true), item('milk', 'חלב', 'milk'), item('tomato', 'עגבניות', 'produce')];
    render(<ListDetailPage />);
    expect(screen.getByText('עגבניות').compareDocumentPosition(screen.getByText('חלב')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ערוך' }));
    await copy();
    expect(mock.writeText).toHaveBeenCalledTimes(1);
    expect(mock.writeText).toHaveBeenCalledWith('עגבניות\nחלב');
    expectMessage(success);
    expect(mock.from).not.toHaveBeenCalled();
    expect(mock.update).not.toHaveBeenCalled();
    expect(mock.remove).not.toHaveBeenCalled();
    expect(mock.reorder).not.toHaveBeenCalled();
  });

  it.each(['pharmacy', 'house', 'vacation_abroad'] as const)('hides copying in %s lists', (type) => {
    mock.list = { ...mock.list!, type };
    render(<ListDetailPage />);
    expect(screen.queryByRole('button', { name: 'העתק רשימה' })).not.toBeInTheDocument();
  });

  it.each(['loading', 'error'] as const)('hides copying during %s', (state) => {
    mock.loading = state === 'loading';
    mock.error = state === 'error' ? 'שגיאה' : null;
    render(<ListDetailPage />);
    expect(screen.queryByRole('button', { name: 'העתק רשימה' })).not.toBeInTheDocument();
  });

  it('waits for clipboard success and blocks duplicate attempts without moving focus', async () => {
    const pending = pendingWrite();
    render(<ListDetailPage />);
    const button = copyButton();
    button.focus();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
    expect(mock.writeText).toHaveBeenCalledTimes(1);
    expectNoMessage(success);
    await act(async () => pending.resolve());
    expectMessage(success);
    expect(copyButton()).toHaveFocus();
    expect(copyButton()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it.each([false, true])('does not overwrite the clipboard when nothing remains (checked=%s)', (checked) => {
    mock.items = checked ? [item('done', 'לחם', 'dry', true)] : [];
    render(<ListDetailPage />);
    expect(copyButton()).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(copyButton());
    expectMessage(empty);
    expect(mock.writeText).not.toHaveBeenCalled();
  });

  it('reports unavailable clipboard support', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    render(<ListDetailPage />);
    await copy();
    expectMessage(failure);
    expectNoMessage(success);
    expect(copyButton()).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('reports rejection and allows a successful retry', async () => {
    mock.writeText.mockRejectedValueOnce(new Error('Permission denied'));
    render(<ListDetailPage />);
    await copy();
    expectMessage(failure);
    expectNoMessage(success);
    await copy();
    expectMessage(success);
    expectNoMessage(failure);
    expect(mock.writeText).toHaveBeenCalledTimes(2);
  });

  it('keeps the active snapshot and uses partner updates on the next copy', async () => {
    const pending = pendingWrite();
    const view = render(<ListDetailPage />);
    fireEvent.click(copyButton());
    mock.items = [item('bread', 'לחם', 'dry')];
    view.rerender(<ListDetailPage />);
    expect(mock.writeText).toHaveBeenNthCalledWith(1, 'חלב 3% — 2 קרטונים');
    await act(async () => pending.resolve());
    await copy();
    expect(mock.writeText).toHaveBeenNthCalledWith(2, 'לחם');
  });

  it('restarts the success timer after a second successful copy', async () => {
    vi.useFakeTimers();
    render(<ListDetailPage />);
    await copy();
    act(() => vi.advanceTimersByTime(2000));
    await copy();
    act(() => vi.advanceTimersByTime(500));
    expectMessage(success);
    act(() => vi.advanceTimersByTime(1900));
    expectNoMessage(success);
  });

  it.each(['unmount', 'list change'] as const)('ignores a late result after %s', async (transition) => {
    const pending = pendingWrite();
    const view = render(<ListDetailPage />);
    fireEvent.click(copyButton());
    if (transition === 'unmount') { view.unmount(); render(<ListDetailPage />); }
    else {
      mock.listId = 'list-b';
      mock.list = { ...mock.list!, id: mock.listId };
      mock.items = [item('new', 'לחם', 'dry')];
      view.rerender(<ListDetailPage />);
    }
    await act(async () => pending.resolve());
    expectNoMessage(success);
    expect(copyButton()).not.toHaveAttribute('aria-disabled', 'true');
    await copy();
    expectMessage(success);
  });

  it.each(['success', 'failure'] as const)('handles zero remaining items while a pending copy ends in %s', async (result) => {
    vi.useFakeTimers();
    const pending = pendingWrite();
    const view = render(<ListDetailPage />);
    fireEvent.click(copyButton());
    mock.items = mock.items.map(value => ({ ...value, ticked: true }));
    view.rerender(<ListDetailPage />);
    await act(async () => result === 'success' ? pending.resolve() : pending.reject(new Error('Denied')));
    expect(copyButton()).toHaveAttribute('aria-disabled', 'true');
    expectMessage(result === 'success' ? success : failure);
    if (result === 'success') act(() => vi.advanceTimersByTime(2400));
    expectMessage(empty);
    fireEvent.click(copyButton());
    expect(mock.writeText).toHaveBeenCalledTimes(1);
  });
});

describe('shopping text import', () => {
  it('opens from the supermarket header and returns focus to the opener', () => {
    render(<ListDetailPage />)
    const opener = screen.getByRole('button',{name:'הוסף מטקסט'})
    opener.focus()
    fireEvent.click(opener)
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByRole('textbox')).toHaveFocus()
    fireEvent.click(screen.getByRole('button',{name:'סגור'}))
    expect(opener).toHaveFocus()
  })
  it('hides the import action on other list types', () => {
    mock.list = {...mock.list!, type:'pharmacy'}
    render(<ListDetailPage />)
    expect(screen.queryByRole('button',{name:'הוסף מטקסט'})).toBeNull()
  })
  it('updates provenance when the partner ticks an imported item and when they undo', () => {
    mock.items.push({...item('cucumber','מלפפונים','produce'),entry_source:'text'})
    const view = render(<ListDetailPage />)
    expect(screen.getAllByText('נוסף מטקסט')).toHaveLength(1)
    mock.items = mock.items.map(i=>({...i,ticked:true}))
    view.rerender(<ListDetailPage />)
    expect(screen.queryByText('נוסף מטקסט')).toBeNull()
    mock.items = mock.items.map(i=>({...i,ticked:false}))
    view.rerender(<ListDetailPage />)
    expect(screen.getAllByText('נוסף מטקסט')).toHaveLength(1)
  })
})
