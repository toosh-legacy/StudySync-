'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown } from 'lucide-react';

export function SummaryView({ output }: { output: Record<string, unknown> }) {
  const [open, setOpen] = useState(true);
  const headline = (output.headline as string) ?? '';
  const points = Array.isArray(output.key_points)
    ? (output.key_points as string[])
    : [];
  const detail = (output.detail as string) ?? '';

  return (
    <article className="space-y-4">
      <h2 className="text-2xl font-black leading-tight">{headline}</h2>
      <ul className="space-y-2 rounded-md brutal-border bg-card p-4">
        {points.map((p, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-accent text-[10px] font-bold text-accent-foreground">
              {i + 1}
            </span>
            <span className="leading-snug">{p}</span>
          </li>
        ))}
      </ul>
      {detail && (
        <div className="rounded-md brutal-border bg-card">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center justify-between p-3 text-sm font-bold uppercase tracking-wide"
          >
            Detail
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>
          {open && (
            <p className="border-t-2 border-foreground/20 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {detail}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
