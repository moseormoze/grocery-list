'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, LoaderCircle } from 'lucide-react';
import messages from '@/messages/he.json';

type CopyState = { phase: 'idle' | 'copying' | 'success' | 'error'; attempt: number };

export function CopyListButton({ text }: { text: string }) {
  const copy = messages.copyList;
  const [state, setState] = useState<CopyState>({ phase: 'idle', attempt: 0 });
  const sequence = useRef(0);
  const pending = useRef(false);
  const busy = state.phase === 'copying';
  const empty = !text && !busy && state.phase !== 'success';
  const feedback = state.phase === 'success' ? copy.success : state.phase === 'error' ? copy.error : '';

  useEffect(() => () => { sequence.current += 1; pending.current = false; }, []);
  useEffect(() => {
    if (state.phase !== 'success') return;
    const timer = setTimeout(() => setState({ ...state, phase: 'idle' }), 2400);
    return () => clearTimeout(timer);
  }, [state]);

  async function handleCopy() {
    if (pending.current || !text) return;
    const attempt = ++sequence.current;
    pending.current = true;
    setState({ phase: 'copying', attempt });
    try {
      await navigator.clipboard.writeText(text);
      if (sequence.current === attempt) setState({ phase: 'success', attempt });
    } catch {
      if (sequence.current === attempt) setState({ phase: 'error', attempt });
    } finally {
      if (sequence.current === attempt) pending.current = false;
    }
  }

  return (
    <div className="copy-list-control" data-tooltip-visible={state.phase === 'idle' && !!text}>
      <button type="button" className="icon-btn copy-list-button" onClick={handleCopy}
        aria-label={busy ? copy.pending : copy.label} aria-disabled={busy || !text} aria-busy={busy}>
        {busy ? <LoaderCircle size={18} className="copy-list-spinner" aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />}
      </button>
      <span className="copy-list-tooltip" aria-hidden="true">{copy.label}</span>
      {(feedback || empty) && (
        <div key={state.attempt} className="copy-list-feedback" data-state={state.phase} aria-hidden="true">
          {state.phase === 'success' && <Check size={16} aria-hidden="true" />}
          <div>{feedback && <div>{feedback}</div>}{empty && <div>{copy.empty}</div>}</div>
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        <span key={state.attempt}>{busy ? copy.pending : state.phase === 'success' ? copy.success : state.phase !== 'error' && empty ? copy.empty : ''}</span>
      </span>
      <span role="alert" className="sr-only">
        {state.phase === 'error' && <span key={state.attempt}>{copy.error}{empty && ` ${copy.empty}`}</span>}
      </span>
    </div>
  );
}
