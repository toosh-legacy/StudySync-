'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SignatureLoader, type LoaderSource, type LoaderCard } from '@/components/landing/SignatureLoader';

const FLOATING_GLYPHS = [
  { top: '10%', left: '5%',  size: 90, glyph: '𓂀', delay: 0 },
  { top: '20%', right: '7%', size: 70, glyph: '𓋹', delay: 1 },
  { top: '55%', left: '3%',  size: 60, glyph: '𓆣', delay: 2 },
  { top: '70%', right: '5%', size: 75, glyph: '𓊽', delay: 1.5 },
];

const NAV_LINKS = [
  { label: 'Sources',     href: '#strip' },
  { label: 'Works',       href: '#how' },
  { label: 'Connections', href: '/dashboard/connections' },
  { label: 'Profile',     href: '/dashboard/settings' },
  { label: 'API',         href: '/dashboard/api-keys' },
];

const MARQUEE_ITEMS = [
  'Google Drive', 'Notion', 'Canvas LMS', 'Moodle', 'Obsidian',
  'PDFs', 'Lecture pages', 'YouTube transcripts', 'GitHub README',
  'Wikipedia', 'Khan Academy', 'Coursera', 'any URL',
];

const DEMO_SOURCES: LoaderSource[] = [
  { name: 'Mendelian inheritance.pdf',       icon: '𓊽', kb: 84, chars: 21340 },
  { name: 'Lecture 7 — Punnett squares',     icon: '𓅓', kb: 32, chars: 11240 },
  { name: 'This page · khanacademy.org',     icon: '𓋹', kb: 18, chars: 6420 },
];

const DEMO_CARDS: LoaderCard[] = [
  { front: 'Define a Punnett square and explain what it predicts.', topic: 'genetics · L1' },
  { front: 'What is the difference between genotype and phenotype?', topic: 'genetics · L1' },
  { front: 'Heterozygous Aa × Aa → expected phenotype ratio?', topic: 'genetics · L2' },
  { front: 'Codominance vs incomplete dominance — name an example.', topic: 'genetics · L3' },
];

function GlyphBackdrop() {
  return (
    <>
      {FLOATING_GLYPHS.map((g, i) => (
        <div
          key={i}
          className="ss-floating-glyph ss-glyph"
          style={{
            top: g.top, left: g.left, right: g.right,
            fontSize: g.size,
            animation: 'ssFloatY 7s ease-in-out infinite',
            animationDelay: `${g.delay}s`,
          }}
        >
          {g.glyph}
        </div>
      ))}
    </>
  );
}

function Counter({ to, duration = 1800 }: { to: number; duration?: number }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    let started = false;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started) {
        started = true;
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setN(Math.floor(eased * to));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to, duration]);

  return <span ref={ref}>{n.toLocaleString()}</span>;
}

function Nav({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'var(--ss-bg)',
      borderBottom: 'var(--ss-rule) solid var(--ss-border)',
    }}>
      <div className="ss-container" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 32px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="ss-glyph" style={{
            width: 38, height: 38,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--ss-brown)',
            color: 'var(--ss-paper)',
            border: 'var(--ss-rule) solid var(--ss-border)',
            boxShadow: '3px 3px 0 0 var(--ss-shadow)',
            fontSize: 22,
          }}>𓋹</div>
          <div>
            <div className="ss-display" style={{
              fontSize: 20, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
            }}>
              StudySync
            </div>
            <div className="ss-mono" style={{
              fontSize: 9, color: 'var(--ss-muted)',
              letterSpacing: '0.18em', textTransform: 'uppercase', marginTop: -2,
            }}>
              chrome extension · v0.4 beta
            </div>
          </div>
        </div>

        <nav className="ss-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {NAV_LINKS.map(l => (
            <Link key={l.label} href={l.href} className="ss-btn ss-btn-ghost ss-btn-sm">{l.label}</Link>
          ))}
          <button
            onClick={() => setDark(!dark)}
            className="ss-btn ss-btn-sm"
            style={{ padding: '8px 12px' }}
            aria-label="Toggle dark mode"
          >
            {dark ? '☀ DAY' : '☾ NIGHT'}
          </button>
          <Link href="/login" className="ss-btn ss-btn-primary ss-btn-sm">
            Add to Chrome ↗
          </Link>
        </nav>
      </div>
    </header>
  );
}

function HeroVisual() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  const sources = [
    { name: 'Google Drive', glyph: '𓊽' },
    { name: 'Notion',       glyph: '𓆣' },
    { name: 'Canvas LMS',   glyph: '𓅓' },
    { name: 'This page',    glyph: '𓋹' },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <div className="ss-bb" style={{
        position: 'absolute', top: 18, left: 18, right: -10, bottom: -10,
        background: 'var(--ss-gold)',
      }} />
      <div className="ss-bb" style={{
        position: 'absolute', top: 10, left: 10, right: -4, bottom: -4,
        background: 'var(--ss-burnt)',
      }} />

      <div className="ss-bb" style={{
        position: 'relative',
        background: 'var(--ss-paper)',
        padding: 22,
        boxShadow: '8px 8px 0 0 var(--ss-shadow)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          paddingBottom: 14, borderBottom: '2px solid var(--ss-ink)', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ss-carnelian)', border: '1.5px solid var(--ss-ink)' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ss-gold)',      border: '1.5px solid var(--ss-ink)' }} />
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ss-lapis)',     border: '1.5px solid var(--ss-ink)' }} />
          </div>
          <div className="ss-mono" style={{ fontSize: 10, color: 'var(--ss-muted)', letterSpacing: '0.15em' }}>
            studysync · popup
          </div>
        </div>

        <div className="ss-eyebrow" style={{ color: 'var(--ss-muted)' }}>course</div>
        <div className="ss-display" style={{ fontSize: 22, marginTop: 4 }}>BIO 220 · Genetics</div>

        <div className="ss-eyebrow" style={{ marginTop: 18, color: 'var(--ss-muted)' }}>sources</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {sources.map((s, i) => (
            <div key={i} className="ss-bb-thin" style={{
              padding: '8px 10px',
              display: 'flex', alignItems: 'center', gap: 8,
              background: tick % 4 === i ? 'var(--ss-gold)' : 'var(--ss-bg)',
              transition: 'background 0.4s',
            }}>
              <span className="ss-glyph" style={{ fontSize: 16 }}>{s.glyph}</span>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{s.name}</span>
              <span className="ss-pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ss-ink)', marginLeft: 'auto' }} />
            </div>
          ))}
        </div>

        <div className="ss-eyebrow" style={{ marginTop: 18, color: 'var(--ss-muted)' }}>format</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {['Flashcards','Notes','Quiz','Guide','Mind Map'].map((f, i) => (
            <span key={i} className="ss-tag" style={{
              background: i === 0 ? 'var(--ss-brown)' : 'var(--ss-paper)',
              color: i === 0 ? 'var(--ss-paper)' : 'var(--ss-ink)',
            }}>{f}</span>
          ))}
        </div>

        <button className="ss-btn ss-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 18 }}>
          <span className="ss-glyph" style={{ fontSize: 18 }}>𓂀</span>
          Generate
          <span className="ss-mono" style={{ fontSize: 10, opacity: 0.7 }}>⌘↵</span>
        </button>
      </div>
    </div>
  );
}

function Hero() {
  const avatarColors = ['var(--ss-gold)','var(--ss-burnt)','var(--ss-brown)','var(--ss-lapis)','var(--ss-carnelian)'];
  return (
    <section style={{
      position: 'relative', overflow: 'hidden',
      minHeight: 'calc(100vh - 67px)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div className="ss-sun-rays" />
      <GlyphBackdrop />

      <div className="ss-container ss-hero-grid" style={{
        position: 'relative',
        paddingTop: 60, paddingBottom: 120,
        display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
        gap: 60,
        alignItems: 'center',
      }}>
        <div className="ss-fade-up">
          <div className="ss-cartouche" style={{ marginBottom: 28 }}>
            <span className="ss-glyph" style={{ fontSize: 18 }}>𓂀</span>
            <span className="ss-eyebrow">eyes on every source</span>
          </div>

          <h1 className="ss-display" style={{
            fontSize: 'clamp(48px, 6.5vw, 88px)',
            margin: 0,
            lineHeight: 0.95,
          }}>
            Study material<br />
            <span style={{
              background: 'linear-gradient(180deg, transparent 60%, var(--ss-gold) 60%)',
              padding: '0 8px',
            }}>carved</span> in seconds.
          </h1>

          <p style={{
            fontSize: 18, color: 'var(--ss-ink-2)',
            maxWidth: 480, marginTop: 24, lineHeight: 1.55,
          }}>
            StudySync reads your <strong>Drive, Notion, Canvas, Moodle</strong> &
            whatever page you&apos;re on — then hands you flashcards, study guides,
            and quizzes before your coffee gets cold.
          </p>

          <div style={{ display: 'flex', gap: 14, marginTop: 36, flexWrap: 'wrap' }}>
            <Link href="/login" className="ss-btn ss-btn-primary ss-btn-lg">
              Add to Chrome <span style={{ fontSize: 18 }}>↗</span>
            </Link>
            <a href="#how" className="ss-btn ss-btn-lg">Watch it work</a>
          </div>

          <div style={{
            marginTop: 36,
            display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {['𓂀','𓆣','𓅓','𓊽','𓋹'].map((g, i) => (
                <div key={i} className="ss-glyph" style={{
                  width: 32, height: 32,
                  marginLeft: i === 0 ? 0 : -8,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: avatarColors[i],
                  color: 'var(--ss-paper)',
                  border: '2px solid var(--ss-ink)',
                  borderRadius: '50%',
                  fontSize: 14,
                }}>{g}</div>
              ))}
            </div>
            <div>
              <div className="ss-mono" style={{ fontSize: 12, fontWeight: 700 }}>
                <Counter to={14829} /> students this semester
              </div>
              <div className="ss-mono" style={{ fontSize: 10, color: 'var(--ss-muted)', letterSpacing: '0.1em' }}>
                free while in beta · no card required
              </div>
            </div>
          </div>
        </div>

        <HeroVisual />
      </div>

      <a href="#strip" className="ss-scroll-cue">
        <div className="ss-mono" style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
          scroll
        </div>
        <div style={{ fontSize: 22, lineHeight: 1 }}>↓</div>
      </a>
    </section>
  );
}

function SourceStrip() {
  const doubled = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];
  return (
    <div id="strip" className="ss-strip-line">
      <div className="ss-marquee-track" style={{ gap: 8 }}>
        {doubled.map((label, i) => (
          <a key={i} href="#how" className="ss-marquee-link">
            <span className="ss-m-glyph">𓋹</span>
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}

function HowItWorks() {
  const [running, setRunning] = useState(false);
  const [course, setCourse] = useState('BIO 220');
  const [format, setFormat] = useState('Flashcards');
  const [depth, setDepth] = useState('Standard');

  const steps = [
    { n: '01', glyph: '𓊽', title: 'Connect once',         body: 'OAuth into Drive, Notion, Canvas, Moodle. Tokens encrypted in Supabase.', detail: 'No more copy-pasting syllabi.' },
    { n: '02', glyph: '𓂀', title: 'Open the popup',       body: 'Pick a course, toggle sources, choose a format. Three clicks tops.',     detail: 'The current tab is always a free source.' },
    { n: '03', glyph: '𓋹', title: 'Receive the tablets',  body: 'Flashcards, notes, quizzes, guides, mind maps — straight to your vault.', detail: 'Share read-only links with classmates.' },
  ];

  return (
    <section id="how" style={{
      padding: '70px 0 90px',
      background: 'var(--ss-bg-2)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div className="ss-papyrus-lines" style={{
        position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none',
      }} />

      <div className="ss-container" style={{ position: 'relative' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'end',
          marginBottom: 40, gap: 24, flexWrap: 'wrap',
        }}>
          <div>
            <div className="ss-eyebrow" style={{ color: 'var(--ss-brown)' }}>⌖ try it · no signup</div>
            <h2 className="ss-display" style={{ fontSize: 'clamp(36px, 5vw, 56px)', margin: '12px 0 0' }}>
              Watch the<br />
              <span style={{ color: 'var(--ss-brown)' }}>monument rise.</span>
            </h2>
          </div>
          <p style={{ maxWidth: 360, color: 'var(--ss-ink-2)', fontSize: 15 }}>
            This is the actual loading sequence — three stages, four seconds.
            Run it as many times as you like.
          </p>
        </div>

        <div className="ss-demo-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, marginBottom: 60 }}>
          <div className="ss-bb ss-bs" style={{ background: 'var(--ss-paper)', padding: 20, alignSelf: 'start' }}>
            <div className="ss-eyebrow" style={{ color: 'var(--ss-muted)' }}>step 01</div>
            <div className="ss-display" style={{ fontSize: 18, marginTop: 4 }}>Choose course</div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['BIO 220','PSY 101','HIST 308'].map(c => (
                <button key={c} onClick={() => setCourse(c)} className="ss-bb-thin ss-press"
                  style={{
                    padding: '10px 12px',
                    background: course === c ? 'var(--ss-brown)' : 'var(--ss-bg)',
                    color: course === c ? 'var(--ss-paper)' : 'var(--ss-ink)',
                    textAlign: 'left', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                  <span className="ss-mono" style={{ fontSize: 9, opacity: 0.7, marginRight: 8 }}>
                    {course === c ? '◉' : '○'}
                  </span>
                  {c}
                </button>
              ))}
            </div>

            <div className="ss-eyebrow" style={{ color: 'var(--ss-muted)', marginTop: 20 }}>step 02</div>
            <div className="ss-display" style={{ fontSize: 18, marginTop: 4 }}>Pick format</div>
            <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {['Flashcards','Notes','Quiz','Guide'].map(f => (
                <button key={f} onClick={() => setFormat(f)} className="ss-bb-thin ss-press"
                  style={{
                    padding: '8px 10px',
                    background: format === f ? 'var(--ss-gold)' : 'var(--ss-bg)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {f}
                </button>
              ))}
            </div>

            <div className="ss-eyebrow" style={{ color: 'var(--ss-muted)', marginTop: 20 }}>step 03</div>
            <div className="ss-display" style={{ fontSize: 18, marginTop: 4 }}>Depth</div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              {['Quick','Standard','Deep'].map(d => (
                <button key={d} onClick={() => setDepth(d)} className="ss-bb-thin ss-press"
                  style={{
                    flex: 1, padding: '8px',
                    background: depth === d ? 'var(--ss-burnt)' : 'var(--ss-bg)',
                    color: depth === d ? 'var(--ss-paper)' : 'var(--ss-ink)',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                  {d}
                </button>
              ))}
            </div>

            {!running ? (
              <button onClick={() => setRunning(true)} className="ss-btn ss-btn-primary"
                style={{ width: '100%', justifyContent: 'center', marginTop: 22, fontSize: 15 }}>
                <span className="ss-glyph" style={{ fontSize: 18 }}>𓂀</span>
                Begin synthesis
              </button>
            ) : (
              <button onClick={() => setRunning(false)} className="ss-btn"
                style={{ width: '100%', justifyContent: 'center', marginTop: 22 }}>
                ↻ Reset
              </button>
            )}
          </div>

          <div>
            {!running ? (
              <div className="ss-bb ss-bs-lg" style={{
                background: 'var(--ss-paper)', padding: 40, minHeight: 460,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', textAlign: 'center', gap: 16,
              }}>
                <div className="ss-glyph" style={{
                  fontSize: 80, color: 'var(--ss-brown)', lineHeight: 1,
                  animation: 'ssFloatY 4s ease-in-out infinite',
                }}>𓂀</div>
                <div className="ss-display" style={{ fontSize: 28 }}>Ready when you are.</div>
                <div style={{ color: 'var(--ss-muted)', maxWidth: 360, fontSize: 14 }}>
                  Hit <strong>Begin synthesis</strong>. We&apos;ll read your sources,
                  raise the monument, and carve your tablets.
                </div>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="ss-tag">course: {course}</span>
                  <span className="ss-tag ss-tag-gold">format: {format.toLowerCase()}</span>
                  <span className="ss-tag">depth: {depth.toLowerCase()}</span>
                </div>
              </div>
            ) : (
              <SignatureLoader sources={DEMO_SOURCES} cards={DEMO_CARDS} running={running} />
            )}
          </div>
        </div>

        <div className="ss-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18 }}>
          {steps.map((s, i) => (
            <div key={s.n} className="ss-bb ss-lift" style={{
              background: i === 1 ? 'var(--ss-gold)' : 'var(--ss-paper)',
              padding: 24, boxShadow: '6px 6px 0 0 var(--ss-shadow)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className="ss-glyph" style={{ fontSize: 42, color: 'var(--ss-ink)' }}>{s.glyph}</span>
                <span className="ss-display" style={{ fontSize: 48, color: 'var(--ss-ink)', opacity: 0.25 }}>{s.n}</span>
              </div>
              <h3 className="ss-display" style={{ fontSize: 22, margin: 0 }}>{s.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--ss-ink-2)', lineHeight: 1.55, marginTop: 10 }}>{s.body}</p>
              <div className="ss-mono" style={{
                marginTop: 16, paddingTop: 12, borderTop: '1.5px dashed var(--ss-ink)',
                fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ss-ink-2)',
              }}>
                ⟶ {s.detail}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const cols = [
    { h: 'Product',   links: [['/login', 'Add to Chrome'], ['/dashboard', 'Web app'], ['/dashboard/settings', 'Profile'], ['/dashboard/api-keys', 'API']] as const },
    { h: 'Sources',   links: [['#strip', 'All sources'], ['/dashboard/connections', 'Connect'], ['#strip', 'Drive'], ['#strip', 'Notion']] as const },
    { h: 'Resources', links: [['/dashboard/api-keys', 'Docs'], ['#', 'Changelog'], ['#', 'Status'], ['#', 'Privacy']] as const },
    { h: 'Company',   links: [['#', 'About'], ['#', 'Contact'], ['#', 'Discord'], ['#', 'GitHub']] as const },
  ];

  return (
    <footer style={{
      background: 'var(--ss-ink)',
      color: 'var(--ss-paper)',
      padding: '40px 0 28px',
    }}>
      <div className="ss-container">
        <div className="ss-footer-grid" style={{
          display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 40,
          paddingBottom: 28,
          borderBottom: '1.5px solid var(--ss-paper)',
          marginBottom: 18,
        }}>
          <div>
            <div className="ss-display" style={{ fontSize: 24, letterSpacing: '0.04em' }}>STUDYSYNC</div>
            <div className="ss-mono" style={{ fontSize: 11, marginTop: 6, opacity: 0.7, letterSpacing: '0.12em' }}>
              <span className="ss-glyph" style={{ fontSize: 16, marginRight: 8 }}>𓋹</span>
              eternal study, instantly
            </div>
          </div>
          <div className="ss-footer-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
            {cols.map(col => (
              <div key={col.h}>
                <div className="ss-eyebrow" style={{ opacity: 0.7 }}>{col.h}</div>
                {col.links.map(([href, l]) => (
                  <Link key={l} href={href} style={{
                    display: 'block', fontSize: 13, marginTop: 8,
                    cursor: 'pointer', opacity: 0.9, color: 'var(--ss-paper)',
                    textDecoration: 'none',
                  }}>{l}</Link>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div className="ss-mono" style={{ fontSize: 11, opacity: 0.6, letterSpacing: '0.1em' }}>
            © {new Date().getFullYear()} StudySync · built by students, for students
          </div>
          <div className="ss-mono" style={{ fontSize: 11, opacity: 0.6, letterSpacing: '0.1em' }}>
            v0.4 · prototype build
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('dark', dark);
    return () => { document.body.classList.remove('dark'); };
  }, [dark]);

  return (
    <div className="ss-root" style={{ position: 'relative', overflowX: 'hidden' }}>
      <div className="ss-papyrus-grain" style={{ position: 'fixed', zIndex: 1000 }} />
      <Nav dark={dark} setDark={setDark} />
      <Hero />
      <SourceStrip />
      <HowItWorks />
      <Footer />
    </div>
  );
}
