import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ListCard } from '../ListCard';
import type { ListWithProgress } from '@/lib/db/types';

const mockList: ListWithProgress = {
  id: 'list-1',
  name: 'רשימת השבת',
  type: 'supermarket',
  household_id: 'hh-1',
  created_at: '2026-05-22T10:00:00Z',
  updated_at: '2026-05-22T10:00:00Z',
};

function renderCard(overrides: Partial<Parameters<typeof ListCard>[0]> = {}) {
  const props = {
    list: mockList,
    ticked: 0,
    total: 0,
    onOpen: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  return { ...render(<ListCard {...props} />), props };
}

function getCardButton(container: HTMLElement): HTMLButtonElement {
  // The card content button is the second button in the rendered tree
  // (first is the red delete background).
  const buttons = container.querySelectorAll('button');
  return buttons[1] as HTMLButtonElement;
}

function getDeleteButton(container: HTMLElement): HTMLButtonElement {
  return container.querySelectorAll('button')[0] as HTMLButtonElement;
}

function getGestureRoot(container: HTMLElement): HTMLDivElement {
  return container.querySelector('div.relative.overflow-hidden') as HTMLDivElement;
}

describe('ListCard — rendering', () => {
  it('renders the list name', () => {
    renderCard({ list: { ...mockList, name: 'קניות לסוף שבוע' } });
    expect(screen.getByText('קניות לסוף שבוע')).toBeTruthy();
  });

  it('renders the supermarket type label', () => {
    renderCard({ list: { ...mockList, type: 'supermarket' } });
    expect(screen.getByText('סופר')).toBeTruthy();
  });

  it('renders the pharmacy type label', () => {
    renderCard({ list: { ...mockList, type: 'pharmacy' } });
    expect(screen.getByText('פארם')).toBeTruthy();
  });

  it('renders the house type label', () => {
    renderCard({ list: { ...mockList, type: 'house' } });
    expect(screen.getByText('בית')).toBeTruthy();
  });

  it('shows the empty badge when total is 0', () => {
    renderCard({ ticked: 0, total: 0 });
    expect(screen.getByText('ריקה')).toBeTruthy();
  });

  it('shows the "X items" badge when total > 0 and ticked === 0', () => {
    renderCard({ ticked: 0, total: 8 });
    expect(screen.getByText('8 פריטים')).toBeTruthy();
  });

  it('shows the "all in cart" badge when ticked equals total', () => {
    renderCard({ ticked: 5, total: 5 });
    expect(screen.getByText('הכל בעגלה')).toBeTruthy();
  });

  it('shows the progress badge with counts when partial', () => {
    renderCard({ ticked: 3, total: 10 });
    expect(screen.getByText('3 מתוך 10')).toBeTruthy();
  });

  it('does not render a progress bar when total is 0', () => {
    const { container } = renderCard({ ticked: 0, total: 0 });
    expect(container.querySelector('.bg-accent.rounded-full')).toBeNull();
  });

  it('renders a progress bar with correct width when partial', () => {
    const { container } = renderCard({ ticked: 3, total: 10 });
    const bar = container.querySelector('.bg-accent.rounded-full') as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.style.width).toBe('30%');
  });

  it('renders the Hebrew date when created_at is present', () => {
    renderCard({ list: { ...mockList, created_at: '2026-05-22T10:00:00Z' } });
    const expected = new Date('2026-05-22T10:00:00Z').toLocaleDateString('he-IL');
    expect(screen.getByText(expected)).toBeTruthy();
  });
});

describe('ListCard — interactions', () => {
  it('calls onOpen when the card is clicked without a drag', () => {
    const { props, container } = renderCard();
    fireEvent.click(getCardButton(container));
    expect(props.onOpen).toHaveBeenCalledTimes(1);
  });

  it('snaps to revealed (120px) on a swipe past 60px and exposes delete', () => {
    const { props, container } = renderCard();
    const root = getGestureRoot(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 80, clientY: 0 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 80, clientY: 0 }] });

    const card = getCardButton(container);
    expect(card.style.transform).toBe('translateX(120px)');

    fireEvent.click(getDeleteButton(container));
    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not call onDelete on a short swipe', () => {
    const { props, container } = renderCard();
    const root = getGestureRoot(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 30, clientY: 0 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 30, clientY: 0 }] });

    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('does not call onOpen on a swipe-then-tap (justFinishedDrag guard)', () => {
    const { props, container } = renderCard();
    const root = getGestureRoot(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 30, clientY: 0 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 30, clientY: 0 }] });
    fireEvent.click(getCardButton(container));

    expect(props.onOpen).not.toHaveBeenCalled();
  });
});

describe('ListCard — press feedback', () => {
  it('applies scale and ink-06 background on touchStart', () => {
    const { container } = renderCard();
    const root = getGestureRoot(container);
    const card = getCardButton(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });

    expect(card.style.transform).toContain('scale(0.965)');
    expect(card.style.backgroundColor).toMatch(/rgba\(28,\s*27,\s*23,\s*0\.06\)/);
  });

  it('clears press state on touchEnd', () => {
    const { container } = renderCard();
    const root = getGestureRoot(container);
    const card = getCardButton(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 0, clientY: 0 }] });

    expect(card.style.transform).not.toContain('scale');
    expect(card.style.backgroundColor).toBe('');
  });

  it('clears press state once a drag starts (diff > 5px)', () => {
    const { container } = renderCard();
    const root = getGestureRoot(container);
    const card = getCardButton(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    expect(card.style.transform).toContain('scale(0.965)');

    fireEvent.touchMove(root, { touches: [{ clientX: 20, clientY: 0 }] });
    expect(card.style.transform).not.toContain('scale');
    expect(card.style.backgroundColor).toBe('');
  });

  it('includes background-color in the transition declaration', () => {
    const { container } = renderCard();
    const card = getCardButton(container);
    expect(card.style.transition).toContain('background-color 120ms');
  });
});

describe('ListCard — rubber-band & spring (T3)', () => {
  it('translates 1:1 with finger up to 120px', () => {
    const { container } = renderCard();
    const root = getGestureRoot(container);
    const card = getCardButton(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 100, clientY: 0 }] });

    expect(card.style.transform).toContain('translateX(100px)');
  });

  it('applies rubber-band resistance past 120px (factor 0.3)', () => {
    const { container } = renderCard();
    const root = getGestureRoot(container);
    const card = getCardButton(container);

    // Target 150 → overflow 30 → 120 + 30*0.3 = 129
    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 150, clientY: 0 }] });

    expect(card.style.transform).toContain('translateX(129px)');
  });

  it('caps rubber-band at 180px even for very large swipes', () => {
    const { container } = renderCard();
    const root = getGestureRoot(container);
    const card = getCardButton(container);

    // Target 600 → overflow 480 → 120 + 480*0.3 = 264 → capped at 180
    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 600, clientY: 0 }] });

    expect(card.style.transform).toContain('translateX(180px)');
  });

  it('uses the spring cubic-bezier easing in its transition', () => {
    const { container } = renderCard();
    const card = getCardButton(container);
    expect(card.style.transition).toContain('cubic-bezier(0.34, 1.56, 0.64, 1)');
    expect(card.style.transition).toContain('250ms');
  });

  it('captures startSwipeX so a fresh touch with diff=10 yields swipeX=10 (not absolute clientX)', () => {
    // Regression guard: the math is relative to current swipeX, not clientX.
    const { container } = renderCard();
    const root = getGestureRoot(container);
    const card = getCardButton(container);

    // Start at clientX=500 (mid-screen). Diff 10 should yield swipeX 10, not 510.
    fireEvent.touchStart(root, { touches: [{ clientX: 500, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 510, clientY: 0 }] });

    expect(card.style.transform).toContain('translateX(10px)');
  });
});

describe('ListCard — swipe-to-commit (T4)', () => {
  it('fires onDelete on touchEnd when swiped past the commit threshold (150px)', () => {
    // diff=220 → target=220 → rubber-band: 120 + (220-120)*0.3 = 150 (== threshold)
    const { props, container } = renderCard();
    const root = getGestureRoot(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 220, clientY: 0 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 220, clientY: 0 }] });

    expect(props.onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not fire onDelete when released below the commit threshold', () => {
    // diff=130 → target=130 → rubber-band: 120 + 10*0.3 = 123 (< 150)
    const { props, container } = renderCard();
    const root = getGestureRoot(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 130, clientY: 0 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 130, clientY: 0 }] });

    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it('uses red-500 (#ef4444) for the delete background while below the threshold', () => {
    const { container } = renderCard();
    const root = getGestureRoot(container);
    const deleteBtn = getDeleteButton(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 80, clientY: 0 }] });

    // jsdom normalises hex to rgb when reading style.backgroundColor.
    expect(deleteBtn.style.backgroundColor).toMatch(/rgb\(239,\s*68,\s*68\)|#ef4444/i);
  });

  it('deepens to red-600 (#dc2626) once swipeX reaches the commit threshold', () => {
    const { container } = renderCard();
    const root = getGestureRoot(container);
    const deleteBtn = getDeleteButton(container);

    // Same 220 diff that pushes swipeX to exactly 150.
    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 220, clientY: 0 }] });

    expect(deleteBtn.style.backgroundColor).toMatch(/rgb\(220,\s*38,\s*38\)|#dc2626/i);
  });

  it('does not trigger onOpen on a tap that follows a full-swipe commit (justFinishedDrag guard)', () => {
    const { props, container } = renderCard();
    const root = getGestureRoot(container);

    fireEvent.touchStart(root, { touches: [{ clientX: 0, clientY: 0 }] });
    fireEvent.touchMove(root, { touches: [{ clientX: 220, clientY: 0 }] });
    fireEvent.touchEnd(root, { changedTouches: [{ clientX: 220, clientY: 0 }] });
    fireEvent.click(getCardButton(container));

    expect(props.onOpen).not.toHaveBeenCalled();
  });
});
