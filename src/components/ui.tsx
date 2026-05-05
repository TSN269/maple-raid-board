import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function classNames(...items: Array<string | false | null | undefined>) {
  return items.filter(Boolean).join(' ');
}

export type PillTone = 'slate' | 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange' | 'dark';

export function Pill({ children, tone = 'slate', className = '' }: { children: ReactNode; tone?: PillTone; className?: string }) {
  const tones: Record<PillTone, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    yellow: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-rose-50 text-rose-700 ring-rose-200',
    blue: 'bg-sky-50 text-sky-700 ring-sky-200',
    purple: 'bg-violet-50 text-violet-700 ring-violet-200',
    orange: 'bg-orange-50 text-orange-700 ring-orange-200',
    dark: 'bg-slate-900/80 text-white ring-white/10',
  };

  return (
    <span className={classNames('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1', tones[tone], className)}>
      {children}
    </span>
  );
}

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' }) {
  const variants = {
    primary: 'bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-[0_12px_24px_-14px_rgba(234,88,12,0.95)] hover:from-orange-400 hover:to-orange-600',
    secondary: 'bg-white text-slate-800 ring-1 ring-orange-100 shadow-sm hover:bg-orange-50/70 hover:text-orange-700',
    ghost: 'bg-transparent text-slate-600 hover:bg-orange-50 hover:text-orange-700',
    danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-500',
    soft: 'bg-orange-50 text-orange-700 ring-1 ring-orange-100 hover:bg-orange-100',
  };

  return (
    <button
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      <span>
        {label} {required ? <span className="text-orange-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}

const fieldClass = 'w-full rounded-2xl border border-orange-100 bg-white/90 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100/80';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={classNames(fieldClass, className)} {...props} />;
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={classNames(fieldClass, className)} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={classNames('min-h-24 resize-none', fieldClass, className)} {...props} />;
}
