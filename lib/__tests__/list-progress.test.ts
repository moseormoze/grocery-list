import { describe, expect, it } from 'vitest';
import { getProgressLabel, shouldShowCompleteTrip } from '../list-progress';

describe('vacation progress behavior', () => {
  it('uses packing copy for not-started, partial, and complete states', () => {
    expect(getProgressLabel('vacation_abroad', 0, 46)).toBe('מתחילים לארוז');
    expect(getProgressLabel('vacation_abroad', 12, 46)).toBe('האריזה בעיצומה');
    expect(getProgressLabel('vacation_abroad', 46, 46)).toBe('הכול ארוז');
  });

  it('never exposes the shopping completion action for vacation lists', () => {
    expect(shouldShowCompleteTrip('vacation_abroad', 12)).toBe(false);
    expect(shouldShowCompleteTrip('vacation_abroad', 46)).toBe(false);
  });

  it('preserves shopping copy and completion behavior for existing types', () => {
    expect(getProgressLabel('supermarket', 0, 5)).toBe('בואו נתחיל');
    expect(getProgressLabel('supermarket', 2, 5)).toBe('בעיצומה של הקניה');
    expect(getProgressLabel('supermarket', 5, 5)).toBe('הכל בעגלה');
    expect(shouldShowCompleteTrip('supermarket', 2)).toBe(true);
    expect(shouldShowCompleteTrip('house', 0)).toBe(false);
  });
});
