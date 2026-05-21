'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlashcardFlip } from '@/components/motion/FlashcardFlip';
import { RotateCw, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface Card {
  front: string;
  back: string;
  topic?: string;
}

export function FlashcardDeck({
  output,
}: {
  output: Record<string, unknown>;
}) {
  const cards = useMemo(() => {
    const c = output.cards;
    return Array.isArray(c) ? (c as Card[]) : [];
  }, [output]);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState<Set<number>>(new Set());
  const [unknown, setUnknown] = useState<Set<number>>(new Set());

  if (cards.length === 0) {
    return (
      <p className="p-4 text-sm text-muted-foreground">No cards in this deck.</p>
    );
  }

  const card = cards[index];
  const reviewed = known.size + unknown.size;
  const progressPct = Math.round((reviewed / cards.length) * 100);
  const finished = reviewed === cards.length;

  const advance = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  };
  const back = () => {
    setFlipped(false);
    setIndex((i) => (i - 1 + cards.length) % cards.length);
  };

  const mark = (status: 'known' | 'unknown') => {
    if (status === 'known') {
      setKnown((s) => new Set(s).add(index));
      setUnknown((s) => {
        const next = new Set(s);
        next.delete(index);
        return next;
      });
    } else {
      setUnknown((s) => new Set(s).add(index));
      setKnown((s) => {
        const next = new Set(s);
        next.delete(index);
        return next;
      });
    }
    advance();
  };

  const reset = () => {
    setKnown(new Set());
    setUnknown(new Set());
    setIndex(0);
    setFlipped(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <Badge variant="outline">
          {index + 1} / {cards.length}
        </Badge>
        <div className="flex gap-2">
          <Badge variant="accent">✓ {known.size}</Badge>
          <Badge variant="destructive">✕ {unknown.size}</Badge>
        </div>
      </div>

      <div className="h-2 w-full rounded-sm brutal-border bg-background overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-200"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => setFlipped((v) => !v)}
        className="block w-full text-left"
      >
        <FlashcardFlip
          cardKey={`${index}`}
          flipped={flipped}
          front={
            <div className="flex h-full flex-col items-center justify-center rounded-md brutal-border brutal-shadow bg-card p-6 text-center">
              {card.topic && (
                <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {card.topic}
                </div>
              )}
              <div className="text-lg font-semibold leading-snug">{card.front}</div>
              <div className="mt-4 text-[10px] uppercase tracking-widest text-muted-foreground">
                Click to flip
              </div>
            </div>
          }
          back={
            <div className="flex h-full flex-col items-center justify-center rounded-md brutal-border brutal-shadow bg-accent text-accent-foreground p-6 text-center">
              <div className="text-base leading-snug">{card.back}</div>
            </div>
          }
        />
      </button>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="destructive"
          onClick={() => mark('unknown')}
          className="gap-2"
        >
          <X className="h-4 w-4" /> Still learning
        </Button>
        <Button variant="accent" onClick={() => mark('known')} className="gap-2">
          <Check className="h-4 w-4" /> Got it
        </Button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={back}>
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCw className="h-3 w-3" /> Restart
        </Button>
        <Button variant="outline" size="sm" onClick={advance}>
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {finished && (
        <div className="rounded-md brutal-border bg-[color:var(--gold)]/30 p-4 text-center">
          <div className="text-sm font-bold uppercase tracking-wide">
            Deck complete
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {known.size} known · {unknown.size} to review · {Math.round((known.size / cards.length) * 100)}% mastery
          </div>
        </div>
      )}
    </div>
  );
}
