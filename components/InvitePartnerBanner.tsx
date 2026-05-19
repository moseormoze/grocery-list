'use client';

import { UserPlus, ChevronLeft } from 'lucide-react';

interface InvitePartnerBannerProps {
  onTap: () => void;
}

export function InvitePartnerBanner({ onTap }: InvitePartnerBannerProps) {
  return (
    <button
      onClick={onTap}
      className="w-full bg-accent-bg rounded-xl p-4 flex items-center gap-3 border-0 cursor-pointer text-right shadow-card hover:shadow-modal transition-all font-inherit text-inherit color-inherit"
      style={{ transition: 'transform 0.12s' }}
      onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.985)')}
      onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      onPointerLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <div className="w-12 h-12 rounded-full bg-accent flex items-center justify-center text-ink flex-shrink-0">
        <UserPlus size={22} />
      </div>
      <div className="flex-1 flex flex-col gap-0.5 min-w-0">
        <div className="text-base font-bold text-ink">הזמן את השותפה שלך</div>
        <div className="text-xs text-ink-70 leading-relaxed">
          שלח לה קישור — היא תצטרף אליך בלחיצה
        </div>
      </div>
      <ChevronLeft size={18} className="text-ink-70 flex-shrink-0" />
    </button>
  );
}
