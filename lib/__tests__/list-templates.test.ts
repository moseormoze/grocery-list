import { describe, expect, it } from 'vitest';
import { LIST_TYPE_META } from '../list-types';
import { getInitialItemsForListType, VACATION_ABROAD_TEMPLATE } from '../list-templates';

describe('vacation abroad list template', () => {
  it('registers vacation abroad as a built-in list type', () => {
    expect(LIST_TYPE_META.vacation_abroad.label).toBe('חופשה בחו״ל');
    expect(LIST_TYPE_META.vacation_abroad.emoji).toBe('🧳');
    expect(LIST_TYPE_META.vacation_abroad.categoryCount).toBe(7);
  });

  it('contains exactly 46 unique, non-empty items', () => {
    const names = VACATION_ABROAD_TEMPLATE.map((item) => item.name);

    expect(VACATION_ABROAD_TEMPLATE).toHaveLength(46);
    expect(names.every((name) => name.trim().length > 0)).toBe(true);
    expect(new Set(names).size).toBe(46);
  });

  it('uses exactly the six populated vacation sections and never seeds other', () => {
    expect(new Set(VACATION_ABROAD_TEMPLATE.map((item) => item.section_id))).toEqual(
      new Set([
        'documents_money',
        'electronics',
        'health_toiletries',
        'clothing_footwear',
        'sea_pool',
        'flight_transit',
      ])
    );
  });

  it('assigns stable, consecutive order indexes and no quantity', () => {
    expect(VACATION_ABROAD_TEMPLATE.map((item) => item.order_index)).toEqual(
      Array.from({ length: 46 }, (_, index) => index)
    );
    expect(VACATION_ABROAD_TEMPLATE.every((item) => item.qty === null)).toBe(true);
  });

  it('returns a fresh vacation template and empty templates for existing types', () => {
    const first = getInitialItemsForListType('vacation_abroad');
    const second = getInitialItemsForListType('vacation_abroad');

    expect(first).toHaveLength(46);
    expect(first).not.toBe(second);
    expect(getInitialItemsForListType('supermarket')).toEqual([]);
    expect(getInitialItemsForListType('pharmacy')).toEqual([]);
    expect(getInitialItemsForListType('house')).toEqual([]);
  });
});
