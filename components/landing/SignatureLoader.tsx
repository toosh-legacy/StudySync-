'use client';

import { useEffect, useRef, useState } from 'react';

export const GLYPHS = ['𓂀','𓆣','𓅓','𓊽','𓋹','𓏏','𓎟','𓇳','𓊪','𓉔','𓂧','𓆑','𓈖','𓊃','𓏃','𓎛','𓅱','𓃭','𓐍','𓆎'];

export type LoaderSource = { name: string; icon: string; kb: number; chars: number };
export type LoaderCard = { front: string; topic: string };

const pickGlyph = (seed: number) => GLYPHS[Math.abs(Math.floor(seed)) % GLYPHS.length];

function SourceDecoder({ source, done }: { source: LoaderSource; done: boolean }) {
  const [glyph, setGlyph] = useState(() => pickGlyph(Math.random() * 100));
  const resolved = done;

  useEffect(() => {
    if (done) return;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setGlyph(pickGlyph(i + source.name.length));
    }, 70);
    return () => clearInterval(id);
  }, [done, source.name]);

  return (
    <div className="ss-bb-thin" style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      background: resolved ? 'var(--ss-gold)' : 'var(--ss-paper)',
      transition: 'background 0.3s',
    }}>
      <div className="ss-glyph" style={{
        width: 32, height: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
        color: 'var(--ss-brown)',
        background: 'var(--ss-bg)',
        border: '1.5px solid var(--ss-ink)',
      }}>
        {resolved ? source.icon : glyph}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ss-ink)' }}>{source.name}</div>
        <div className="ss-mono" style={{
          fontSize: 10,
          color: resolved ? 'var(--ss-ink)' : 'var(--ss-muted)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
        }}>
          {resolved ? `✓ ${source.chars.toLocaleString()} chars` : 'decoding…'}
        </div>
      </div>
      {resolved && (
        <div className="ss-mono" style={{ fontSize: 11, color: 'var(--ss-ink)', fontWeight: 700 }}>
          {source.kb}KB
        </div>
      )}
    </div>
  );
}

function PyramidBuilder({ progress, lit }: { progress: number; lit: boolean }) {
  const rows = [
    { count: 7, y: 180, isCap: false },
    { count: 5, y: 130, isCap: false },
    { count: 3, y: 80, isCap: false },
    { count: 1, y: 30, isCap: true },
  ];
  let brickIdx = 0;
  const totalBricks = rows.reduce((s, r) => s + r.count, 0);

  return (
    <svg viewBox="0 0 320 240" style={{ width: '100%', maxWidth: 360 }}>
      <defs>
        <radialGradient id="ss-sun" cx="50%" cy="50%">
          <stop offset="0%" stopColor="var(--ss-gold)" stopOpacity="0.9" />
          <stop offset="100%" stopColor="var(--ss-gold)" stopOpacity="0" />
        </radialGradient>
        <filter id="ss-capGlow">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <circle cx="160" cy="60" r="80" fill="url(#ss-sun)"
        style={{ opacity: lit ? 1 : 0.3, transition: 'opacity 0.6s' }} />

      <line x1="20" y1="220" x2="300" y2="220" stroke="var(--ss-ink)" strokeWidth="2.5" />
      <g>
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={i} x1={20 + i * 15} y1="220" x2={28 + i * 15} y2="232"
            stroke="var(--ss-ink)" strokeWidth="1.5" />
        ))}
      </g>

      {rows.map((row, rowIdx) => {
        const brickWidth = 36;
        const rowWidth = row.count * brickWidth;
        const startX = (320 - rowWidth) / 2;
        return Array.from({ length: row.count }).map((_, i) => {
          const myIdx = brickIdx++;
          const myProgress = (myIdx + 1) / totalBricks;
          const built = progress >= myProgress;
          const fillColor = row.isCap && lit ? 'var(--ss-gold)'
            : row.isCap ? 'var(--ss-carnelian)'
            : built ? 'var(--ss-paper)' : 'transparent';
          return (
            <g key={`${rowIdx}-${i}`} style={{
              opacity: built ? 1 : 0,
              transform: built ? 'translateY(0)' : 'translateY(-30px)',
              transformOrigin: 'center',
              transition: 'opacity 0.4s, transform 0.5s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <rect
                x={startX + i * brickWidth}
                y={row.y}
                width={brickWidth - 2}
                height={48}
                fill={fillColor}
                stroke="var(--ss-ink)"
                strokeWidth="2"
                filter={row.isCap && lit ? 'url(#ss-capGlow)' : ''}
              />
              {row.isCap && lit && (
                <rect
                  x={startX + i * brickWidth}
                  y={row.y}
                  width={brickWidth - 2}
                  height={48}
                  fill="var(--ss-gold)"
                  stroke="var(--ss-gold-2)"
                  strokeWidth="2"
                  opacity="0.8"
                />
              )}
            </g>
          );
        });
      })}

      {lit && (
        <g style={{ animation: 'ssRayPulse 1.2s ease-in-out infinite' }}>
          <line x1="160" y1="54" x2="160" y2="220" stroke="var(--ss-gold)" strokeWidth="3" opacity="0.7" />
          <line x1="160" y1="54" x2="80" y2="220" stroke="var(--ss-gold)" strokeWidth="2" opacity="0.4" />
          <line x1="160" y1="54" x2="240" y2="220" stroke="var(--ss-gold)" strokeWidth="2" opacity="0.4" />
        </g>
      )}
    </svg>
  );
}

function TabletReveal({ cards }: { cards: LoaderCard[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
      {cards.map((card, i) => (
        <div key={i} className="ss-tablet ss-bs-sm ss-fade-up" style={{
          padding: 16,
          animationDelay: `${i * 0.12}s`,
          minHeight: 110,
        }}>
          <div className="ss-mono" style={{
            fontSize: 9, letterSpacing: '0.18em',
            color: 'var(--ss-muted)', textTransform: 'uppercase', marginBottom: 8,
          }}>
            ↟ tablet {String(i + 1).padStart(2, '0')}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ss-ink)', lineHeight: 1.35 }}>
            {card.front}
          </div>
          <div className="ss-mono" style={{
            fontSize: 10, color: 'var(--ss-brown)',
            marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--ss-muted)',
          }}>
            {card.topic}
          </div>
        </div>
      ))}
    </div>
  );
}

type Burst = { id: number; glyph: string; end: string; rot: string };

export function SignatureLoader({
  sources, cards, running, onComplete,
}: {
  sources: LoaderSource[];
  cards: LoaderCard[];
  running: boolean;
  onComplete?: () => void;
}) {
  const [stage, setStage] = useState(1);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [pyramidProgress, setPyramidProgress] = useState(0);
  const [capLit, setCapLit] = useState(false);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstRef = useRef(0);

  useEffect(() => {
    if (!running) return;

    const timers: ReturnType<typeof setTimeout>[] = [];

    sources.forEach((_, i) => {
      timers.push(setTimeout(() => setResolvedCount(i + 1), 700 + i * 600));
    });

    const stage2Start = 700 + sources.length * 600 + 200;
    timers.push(setTimeout(() => setStage(2), stage2Start));

    const buildSteps = 16;
    for (let i = 1; i <= buildSteps; i++) {
      timers.push(setTimeout(() => {
        setPyramidProgress(i / buildSteps);
      }, stage2Start + (i * (2800 / buildSteps))));
    }

    timers.push(setTimeout(() => {
      setCapLit(true);
      const newBursts: Burst[] = [];
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.4;
        const dist = 80 + Math.random() * 60;
        newBursts.push({
          id: burstRef.current++,
          glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          end: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px)`,
          rot: `${(Math.random() * 360) - 180}deg`,
        });
      }
      setBursts(newBursts);
    }, stage2Start + 2900));

    timers.push(setTimeout(() => {
      setStage(3);
      setBursts([]);
      onComplete?.();
    }, stage2Start + 3600));

    return () => timers.forEach(clearTimeout);
  }, [running, sources, onComplete]);

  return (
    <div className="ss-bb ss-bs-lg" style={{
      background: 'var(--ss-paper)',
      padding: 28,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 460,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="ss-pulse-dot" style={{
            width: 10, height: 10, borderRadius: '50%',
            background: stage === 3 ? 'var(--ss-gold)' : 'var(--ss-carnelian)',
          }} />
          <div className="ss-eyebrow" style={{ color: 'var(--ss-ink)' }}>
            {stage === 1 && '01 · reading the scrolls'}
            {stage === 2 && '02 · raising the monument'}
            {stage === 3 && '03 · carved & ready'}
          </div>
        </div>
        <div className="ss-mono" style={{ fontSize: 11, color: 'var(--ss-muted)' }}>
          {stage === 3 ? 'complete' : 'gpt-4o-mini'}
        </div>
      </div>

      {stage === 1 && (
        <div style={{ position: 'relative', minHeight: 360 }}>
          <div className="ss-scanline" />
          <div style={{ display: 'grid', gap: 10 }}>
            {sources.map((s, i) => (
              <SourceDecoder key={s.name} source={s} done={i < resolvedCount} />
            ))}
          </div>
          <div className="ss-mono" style={{
            marginTop: 24, fontSize: 11, color: 'var(--ss-muted)',
            letterSpacing: '0.15em', textTransform: 'uppercase', textAlign: 'center',
          }}>
            {resolvedCount} / {sources.length} sources decoded
          </div>
        </div>
      )}

      {stage === 2 && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, position: 'relative', minHeight: 360,
        }}>
          <PyramidBuilder progress={pyramidProgress} lit={capLit} />
          <div className="ss-mono" style={{
            fontSize: 11, color: 'var(--ss-muted)',
            letterSpacing: '0.15em', textTransform: 'uppercase',
          }}>
            {capLit
              ? 'capstone aligned · channeling sources'
              : `synthesizing · ${Math.round(pyramidProgress * 100)}%`}
          </div>
          {bursts.map(b => (
            <span
              key={b.id}
              className="ss-burst-glyph"
              style={{
                top: '40%', left: '50%',
                ['--ss-end' as string]: b.end,
                ['--ss-rot' as string]: b.rot,
              } as React.CSSProperties}
            >
              {b.glyph}
            </span>
          ))}
        </div>
      )}

      {stage === 3 && (
        <div>
          <TabletReveal cards={cards} />
          <div style={{
            marginTop: 20, paddingTop: 18, borderTop: '1.5px solid var(--ss-ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10,
          }}>
            <div className="ss-mono" style={{ fontSize: 11, color: 'var(--ss-ink)' }}>
              ⌖ {cards.length * 4} cards · {sources.length} sources · 4.2s
            </div>
            <button className="ss-btn ss-btn-primary ss-btn-sm">
              Save to vault →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
