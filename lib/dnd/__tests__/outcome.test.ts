import { describe, it, expect } from 'vitest';
import { computeDragOutcome } from '../outcome';
import type { Item } from '@/lib/db/types';

function mockItem(overrides: Partial<Item>): Item {
  return {
    id: 'item-1',
    list_id: 'list-1',
    name: 'name',
    section_id: 'produce',
    ticked: false,
    order_index: 0,
    created_by_user_id: 'user-1',
    created_at: '2026-05-25T00:00:00Z',
    updated_at: '2026-05-25T00:00:00Z',
    ...overrides,
  };
}

describe('computeDragOutcome', () => {
  const items: Item[] = [
    mockItem({ id: 'a1', section_id: 'produce', order_index: 0 }),
    mockItem({ id: 'a2', section_id: 'produce', order_index: 1 }),
    mockItem({ id: 'a3', section_id: 'produce', order_index: 2 }),
    mockItem({ id: 'b1', section_id: 'milk', order_index: 3 }),
    mockItem({ id: 'b2', section_id: 'milk', order_index: 4 }),
  ];

  it('returns none when overId is null', () => {
    expect(
      computeDragOutcome({ activeId: 'a1', overId: null, items })
    ).toEqual({ kind: 'none' });
  });

  it('returns none when active and over are the same id', () => {
    expect(
      computeDragOutcome({ activeId: 'a1', overId: 'a1', items })
    ).toEqual({ kind: 'none' });
  });

  it('returns reorder when active and over are in the same section', () => {
    const outcome = computeDragOutcome({
      activeId: 'a1',
      overId: 'a3',
      items,
    });
    expect(outcome.kind).toBe('reorder');
    if (outcome.kind !== 'reorder') return;
    expect(outcome.sectionId).toBe('produce');
    expect(outcome.orderedIds).toEqual(['a2', 'a3', 'a1']);
  });

  it('returns reorder preserving section even with order_index gaps', () => {
    const gappy: Item[] = [
      mockItem({ id: 'g1', section_id: 'milk', order_index: 0 }),
      mockItem({ id: 'g2', section_id: 'milk', order_index: 5 }),
      mockItem({ id: 'g3', section_id: 'milk', order_index: 99 }),
    ];
    const outcome = computeDragOutcome({
      activeId: 'g3',
      overId: 'g1',
      items: gappy,
    });
    expect(outcome.kind).toBe('reorder');
    if (outcome.kind !== 'reorder') return;
    expect(outcome.orderedIds).toEqual(['g3', 'g1', 'g2']);
  });

  it('returns none for cross-section drag in T1 (handled in T2)', () => {
    expect(
      computeDragOutcome({ activeId: 'a1', overId: 'b1', items })
    ).toEqual({ kind: 'none' });
  });

  it('returns none when activeId is not in items', () => {
    expect(
      computeDragOutcome({ activeId: 'missing', overId: 'a1', items })
    ).toEqual({ kind: 'none' });
  });

  it('returns none when overId is not in items', () => {
    expect(
      computeDragOutcome({ activeId: 'a1', overId: 'missing', items })
    ).toEqual({ kind: 'none' });
  });
});
