import { describe, expect, it } from 'vitest';
import { formatCopyList } from '../copy-list';

describe('formatCopyList', () => {
  it('copies unchecked items in display order with only names and quantities', () => {
    expect(formatCopyList([
      { name: 'חלב 3%', qty: '2 קרטונים', ticked: false },
      { name: 'בננות', qty: 'אשכול', ticked: true },
      { name: 'Coca-Cola Zero', qty: 'שתי חבילות', ticked: false },
      { name: 'לחם', ticked: false },
    ])).toBe('חלב 3% — 2 קרטונים\nCoca-Cola Zero — שתי חבילות\nלחם');
  });

  it.each([undefined, '', '  \t '])('omits an absent quantity (%j)', (qty) => {
    expect(formatCopyList([{ name: 'לחם', qty, ticked: false }])).toBe('לחם');
  });

  it('preserves nonempty values exactly, including whitespace and numeric text', () => {
    expect(formatCopyList([
      { name: '  חלב 3% ', qty: ' 2 קרטונים ', ticked: false },
      { name: 'מלח', qty: '0', ticked: false },
    ])).toBe('  חלב 3%  —  2 קרטונים \nמלח — 0');
  });

  it('returns empty text when there is nothing left to copy', () => {
    expect(formatCopyList([])).toBe('');
    expect(formatCopyList([{ name: 'לחם', ticked: true }])).toBe('');
  });

  it('keeps separate items with identical names without mutating the input', () => {
    const items = Object.freeze([
      Object.freeze({ name: 'יוגורט', qty: '2 גביעים', ticked: false }),
      Object.freeze({ name: 'יוגורט', qty: 'גביע', ticked: false }),
    ]);
    const before = JSON.stringify(items);

    expect(formatCopyList(items)).toBe('יוגורט — 2 גביעים\nיוגורט — גביע');
    expect(JSON.stringify(items)).toBe(before);
  });
});
