'use client';

import { Badge } from '@/components/ui/badge';

interface Section {
  heading: string;
  body: string;
  key_terms?: string[];
}

export function StudyGuide({ output }: { output: Record<string, unknown> }) {
  const title = (output.title as string) ?? 'Study guide';
  const sections = Array.isArray(output.sections) ? (output.sections as Section[]) : [];
  const summary = (output.summary as string) ?? '';

  return (
    <article className="space-y-4">
      <h2 className="text-xl font-black uppercase tracking-wide">{title}</h2>
      {sections.map((s, i) => (
        <section
          key={i}
          className="rounded-md brutal-border bg-card p-4 space-y-2"
        >
          <h3 className="font-bold uppercase text-sm tracking-wide">{s.heading}</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{s.body}</p>
          {s.key_terms && s.key_terms.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {s.key_terms.map((t, ti) => (
                <Badge key={ti} variant="accent">
                  {t}
                </Badge>
              ))}
            </div>
          )}
        </section>
      ))}
      {summary && (
        <div className="rounded-md brutal-border bg-[color:var(--gold)]/25 p-4">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest">
            Summary
          </div>
          <p className="text-sm leading-relaxed">{summary}</p>
        </div>
      )}
    </article>
  );
}
