'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, RotateCw } from 'lucide-react';

interface Question {
  question: string;
  answer: string;
  difficulty?: string;
  topic?: string;
}

type Mark = 'correct' | 'incorrect' | null;

export function QuizMode({ output }: { output: Record<string, unknown> }) {
  const questions = useMemo(() => {
    const q = output.questions;
    return Array.isArray(q) ? (q as Question[]) : [];
  }, [output]);

  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [marks, setMarks] = useState<Record<number, Mark>>({});

  if (questions.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No questions.</p>;
  }

  const toggle = (i: number) =>
    setRevealed((s) => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  const setMark = (i: number, m: Mark) =>
    setMarks((prev) => ({ ...prev, [i]: m }));

  const reset = () => {
    setRevealed(new Set());
    setMarks({});
  };

  const correctCount = Object.values(marks).filter((m) => m === 'correct').length;
  const answeredCount = Object.values(marks).filter(Boolean).length;
  const finished = answeredCount === questions.length;
  const scorePct = finished
    ? Math.round((correctCount / questions.length) * 100)
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <Badge variant="outline">
          {answeredCount} / {questions.length} answered
        </Badge>
        {finished && (
          <Badge variant={scorePct >= 70 ? 'accent' : 'destructive'}>
            Score: {scorePct}%
          </Badge>
        )}
      </div>

      <ol className="space-y-2">
        {questions.map((q, i) => {
          const isOpen = revealed.has(i);
          const mark = marks[i];
          return (
            <li
              key={i}
              className="rounded-md brutal-border bg-card p-3"
            >
              <button
                type="button"
                onClick={() => toggle(i)}
                className="flex w-full items-start gap-2 text-left"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm brutal-border bg-accent text-xs font-bold text-accent-foreground">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm font-medium leading-snug">
                  {q.question}
                  {(q.topic || q.difficulty) && (
                    <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      {[q.topic, q.difficulty].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {isOpen && (
                <div className="mt-3 space-y-2 border-t-2 border-foreground/20 pt-3">
                  <div className="rounded-sm bg-muted/50 p-3 text-sm">
                    {q.answer}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant={mark === 'correct' ? 'accent' : 'outline'}
                      onClick={() => setMark(i, mark === 'correct' ? null : 'correct')}
                    >
                      I got it
                    </Button>
                    <Button
                      size="sm"
                      variant={mark === 'incorrect' ? 'destructive' : 'outline'}
                      onClick={() =>
                        setMark(i, mark === 'incorrect' ? null : 'incorrect')
                      }
                    >
                      Missed it
                    </Button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCw className="h-3 w-3" /> Reset
        </Button>
        {finished && (
          <span className="text-xs text-muted-foreground">
            {correctCount} correct / {questions.length - correctCount} missed
          </span>
        )}
      </div>
    </div>
  );
}
