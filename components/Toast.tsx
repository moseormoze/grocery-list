'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  show: boolean;
  message: string;
  tone?: 'default' | 'success' | 'error';
  duration?: number;
  onClose?: () => void;
}

export function Toast({ show, message, tone = 'default', duration = 2400, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [show, duration, onClose]);

  const tones = {
    default: { bg: '#1C1B17', fg: '#FAF6EE' },
    success: { bg: '#C77858', fg: '#fff' },
    error: { bg: '#B14A33', fg: '#fff' },
  };

  const tone_style = tones[tone];

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 110,
        zIndex: 70,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: tone_style.bg,
          color: tone_style.fg,
          padding: '12px 20px',
          borderRadius: 999,
          fontSize: 15,
          fontWeight: 500,
          boxShadow: '0 8px 24px rgba(0,0,0,.18)',
          transform: isVisible ? 'translateY(0)' : 'translateY(20px)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 250ms, opacity 250ms',
          whiteSpace: 'nowrap',
        }}
      >
        {message}
      </div>
    </div>
  );
}
