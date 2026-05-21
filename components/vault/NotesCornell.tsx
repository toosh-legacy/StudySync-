'use client';

import ReactMarkdown from 'react-markdown';

interface NotesOutput {
  title?: string;
  cue_column?: string[];
  notes_column?: string;
  summary?: string;
}

export function NotesCornell({ output }: { output: Record<string, unknown> }) {
  const o = output as NotesOutput;
  const cues = Array.isArray(o.cue_column) ? o.cue_column : [];

  return (
    <article className="space-y-4">
      {o.title && (
        <h2 className="text-xl font-black uppercase tracking-wide">{o.title}</h2>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_2.2fr]">
        <aside className="rounded-md brutal-border bg-[color:var(--gold)]/20 p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Cues
          </div>
          <ul className="space-y-2 text-sm">
            {cues.map((c, i) => (
              <li key={i} className="leading-snug">
                <span className="mr-1 text-accent">›</span>
                {c}
              </li>
            ))}
          </ul>
        </aside>
        <section className="rounded-md brutal-border bg-card p-4 prose-egyptian">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Notes
          </div>
          <div className="markdown-body text-sm leading-relaxed">
            <ReactMarkdown>{o.notes_column ?? ''}</ReactMarkdown>
          </div>
        </section>
      </div>
      {o.summary && (
        <div className="rounded-md brutal-border bg-accent/15 p-4">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-widest">
            Summary
          </div>
          <p className="text-sm leading-relaxed">{o.summary}</p>
        </div>
      )}
    </article>
  );
}
