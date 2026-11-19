import { describe, it, expect } from 'vitest';
import { SECTIONS_BY_TYPE } from '../categories';

describe('SECTIONS_BY_TYPE — supermarket', () => {
  const sections = SECTIONS_BY_TYPE.supermarket;
  const keys = Object.keys(sections);

  it('renames "dry" section label from יבש to מזווה', () => {
    expect(sections.dry).toBeDefined();
    expect(sections.dry.name).toBe('מזווה');
  });

  it('adds a "sauces" section with the label רטבים וממרחים', () => {
    expect(sections.sauces).toBeDefined();
    expect(sections.sauces.name).toBe('רטבים וממרחים');
    expect(sections.sauces.emoji).toBeTruthy();
    expect(sections.sauces.tint).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(sections.sauces.ink).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('places "sauces" between "dry" and "baking"', () => {
    const dryIdx = keys.indexOf('dry');
    const saucesIdx = keys.indexOf('sauces');
    const bakingIdx = keys.indexOf('baking');
    expect(dryIdx).toBeGreaterThan(-1);
    expect(saucesIdx).toBe(dryIdx + 1);
    expect(bakingIdx).toBe(saucesIdx + 1);
  });

  it('keeps the rest of the supermarket sections present', () => {
    for (const key of ['produce', 'milk', 'meat', 'baking', 'snacks', 'drinks', 'frozen', 'cleaning', 'other']) {
      expect(sections[key as keyof typeof sections]).toBeDefined();
    }
  });
});

describe('SECTIONS_BY_TYPE — pharmacy (unchanged)', () => {
  it('keeps "medicine_cabinet" labeled מזווה (no change)', () => {
    expect(SECTIONS_BY_TYPE.pharmacy.medicine_cabinet.name).toBe('מזווה');
  });
});

describe('SECTIONS_BY_TYPE — vacation abroad', () => {
  const sections = SECTIONS_BY_TYPE.vacation_abroad;

  it('defines the seven vacation categories in their display order', () => {
    expect(Object.keys(sections)).toEqual([
      'documents_money',
      'electronics',
      'health_toiletries',
      'clothing_footwear',
      'sea_pool',
      'flight_transit',
      'other',
    ]);
  });

  it('keeps other available as an empty-list destination', () => {
    expect(sections.other.name).toBe('אחר');
    expect(sections.other.emoji).toBe('📦');
  });
});
