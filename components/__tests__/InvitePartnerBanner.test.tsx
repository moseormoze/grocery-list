import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvitePartnerBanner } from '../InvitePartnerBanner';

describe('InvitePartnerBanner', () => {
  it('renders the invite CTA title and description in Hebrew', () => {
    render(<InvitePartnerBanner onTap={() => {}} />);
    expect(screen.getByText('הזמן את השותפה שלך')).toBeTruthy();
    expect(screen.getByText(/שלח לה קישור/)).toBeTruthy();
  });

  it('calls onTap when the banner is clicked', () => {
    const onTap = vi.fn();
    render(<InvitePartnerBanner onTap={onTap} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onTap).toHaveBeenCalledTimes(1);
  });
});
