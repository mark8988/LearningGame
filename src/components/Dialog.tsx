import { useEffect, useRef, type ReactNode } from 'react';
import { Leaf, X } from 'lucide-react';
export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onClick={onClose}><section ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} onKeyDown={e => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Tab') {
      const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
      if (!buttons?.length) return;
      const first = buttons[0]; const last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }}><button className="close-dialog" aria-label="關閉" onClick={onClose}><X size={20} /></button><span className="small-icon"><Leaf size={24} /></span><h2>{title}</h2>{children}</section></div>;
}
