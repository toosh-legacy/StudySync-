import { useEffect, useState } from 'react';
import { useCourses } from './hooks/useCourses';
import { useConnections } from './hooks/useConnections';
import { useGenerate } from './hooks/useGenerate';
import {
  clearSession,
  getApiBase,
  getAppBase,
  getSessionToken,
  setStorage,
} from './lib/storage';
import type { ConnectionStatus, Course } from './lib/storage';

const FORMATS = [
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'study_guide', label: 'Study guide' },
  { id: 'notes', label: 'Notes' },
  { id: 'practice_questions', label: 'Practice Qs' },
  { id: 'summary', label: 'Summary' },
  { id: 'mind_map', label: 'Mind map' },
];

const DEPTHS = ['quick', 'standard', 'deep'];

const PROVIDER_LABEL: Record<ConnectionStatus['provider'], string> = {
  google_drive: 'Google Drive',
  notion: 'Notion',
  canvas: 'Canvas',
  moodle: 'Moodle',
  obsidian: 'Obsidian',
};

export function App() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getSessionToken();
      if (!cancelled) setSignedIn(Boolean(token));
    })();
    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'local' || !('session_token' in changes)) return;
      setSignedIn(Boolean(changes.session_token.newValue));
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  if (signedIn === null) return <Loading />;
  if (!signedIn) return <SignInPanel onSignedIn={() => setSignedIn(true)} />;
  return (
    <MainPanel
      onSignOut={async () => {
        await clearSession();
        setSignedIn(false);
      }}
    />
  );
}

function Loading() {
  return (
    <div className="ss-panel">
      <div className="ss-content">
        <p className="ss-dim">Loading…</p>
      </div>
    </div>
  );
}

function SignInPanel({ onSignedIn: _onSignedIn }: { onSignedIn: () => void }) {
  const [appBase, setAppBase] = useState('http://localhost:3000');
  const [apiBase, setApiBase] = useState('http://localhost:3001');

  useEffect(() => {
    void (async () => {
      setAppBase(await getAppBase());
      setApiBase(await getApiBase());
    })();
  }, []);

  const startSignIn = () => {
    chrome.tabs.create({ url: `${appBase}/login?ext=1` });
  };

  return (
    <div className="ss-panel">
      <div className="ss-header">
        <span className="ss-logo">☥ StudySync</span>
      </div>
      <div className="ss-content">
        <h1 className="ss-h1">Sign in</h1>
        <p className="ss-dim">
          Open the StudySync web app, finish the OAuth flow, and this popup
          will sign in automatically.
        </p>
        <div className="ss-actions">
          <button type="button" className="ss-btn-primary" onClick={startSignIn}>
            Sign in via web app →
          </button>
        </div>
        <details className="ss-details">
          <summary>Advanced: configure URLs</summary>
          <label className="ss-section-label">Web app URL</label>
          <input
            className="ss-input"
            value={appBase}
            onChange={(e) => setAppBase(e.target.value)}
            placeholder="http://localhost:3000"
          />
          <label className="ss-section-label">API base URL</label>
          <input
            className="ss-input"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder="http://localhost:3001"
          />
          <button
            type="button"
            className="ss-btn-outline"
            onClick={async () => {
              await setStorage({
                app_base: appBase.replace(/\/+$/, ''),
                api_base: apiBase.replace(/\/+$/, ''),
              });
            }}
          >
            Save URLs
          </button>
        </details>
      </div>
    </div>
  );
}

function MainPanel({ onSignOut }: { onSignOut: () => void }) {
  const { courses, addCourse, error: coursesError } = useCourses();
  const { connections, error: connError } = useConnections();
  const { status, errorMessage, result, run, reset } = useGenerate();

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState('flashcards');
  const [selectedDepth, setSelectedDepth] = useState('standard');
  const [selectedProviders, setSelectedProviders] = useState<
    ConnectionStatus['provider'][]
  >([]);
  const [includePage, setIncludePage] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [addingOpen, setAddingOpen] = useState(false);

  useEffect(() => {
    if (connections) {
      setSelectedProviders(connections.map((c) => c.provider));
    }
  }, [connections]);

  const onAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const created = await addCourse({
      name: newName.trim(),
      code: newCode.trim() || undefined,
    });
    if (created) {
      setSelectedCourseId(created.id);
      setNewName('');
      setNewCode('');
      setAddingOpen(false);
    }
  };

  const toggleProvider = (p: ConnectionStatus['provider']) => {
    setSelectedProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const isBusy = status === 'extracting' || status === 'collecting' || status === 'generating';
  const canGenerate =
    Boolean(selectedCourseId) &&
    (selectedProviders.length > 0 || includePage) &&
    !isBusy;

  if (result) {
    return (
      <ResultView
        result={result}
        onBack={reset}
      />
    );
  }

  return (
    <div className="ss-panel">
      <div className="ss-header">
        <span className="ss-logo">☥ StudySync</span>
        <div className="ss-actions">
          <button
            type="button"
            className="ss-icon-btn"
            title="Open dashboard"
            onClick={async () => {
              const app = await getAppBase();
              chrome.tabs.create({ url: `${app}/dashboard` });
            }}
          >
            ⤴
          </button>
          <button
            type="button"
            className="ss-icon-btn"
            title="Sign out"
            onClick={onSignOut}
          >
            ⎋
          </button>
        </div>
      </div>

      <div className="ss-content">
        {coursesError && <p className="ss-err">{coursesError}</p>}
        {connError && <p className="ss-err">{connError}</p>}

        <section className="ss-section">
          <label className="ss-section-label">Course</label>
          <CourseList
            courses={courses ?? []}
            selectedId={selectedCourseId}
            onSelect={setSelectedCourseId}
          />
          {addingOpen ? (
            <form
              onSubmit={onAddCourse}
              style={{ display: 'grid', gap: 6 }}
            >
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="CODE"
                maxLength={16}
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Course name"
                required
              />
              <div className="ss-actions">
                <button type="submit" className="ss-btn-primary">
                  Add
                </button>
                <button
                  type="button"
                  className="ss-btn-outline"
                  onClick={() => setAddingOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="ss-btn-ghost"
              onClick={() => setAddingOpen(true)}
            >
              + Add course
            </button>
          )}
        </section>

        <section className="ss-section">
          <label className="ss-section-label">Sources</label>
          {connections && connections.length > 0 ? (
            connections.map((c) => (
              <label key={c.provider} className="ss-row">
                <input
                  type="checkbox"
                  style={{ width: 'auto' }}
                  checked={selectedProviders.includes(c.provider)}
                  onChange={() => toggleProvider(c.provider)}
                />
                <span>
                  <span>{PROVIDER_LABEL[c.provider]}</span>
                  {c.detail_label && (
                    <span className="ss-dim"> · {c.detail_label}</span>
                  )}
                </span>
              </label>
            ))
          ) : (
            <p className="ss-dim">No connected sources yet.</p>
          )}
          <label className="ss-row">
            <input
              type="checkbox"
              style={{ width: 'auto' }}
              checked={includePage}
              onChange={(e) => setIncludePage(e.target.checked)}
            />
            <span>Current page content</span>
          </label>
          <button
            type="button"
            className="ss-btn-ghost"
            onClick={async () => {
              const app = await getAppBase();
              chrome.tabs.create({ url: `${app}/connections` });
            }}
          >
            Connect more sources →
          </button>
        </section>

        <section className="ss-section">
          <label className="ss-section-label">Output format</label>
          <div className="ss-format-grid">
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={
                  'ss-tile' + (selectedFormat === f.id ? ' is-selected' : '')
                }
                onClick={() => setSelectedFormat(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </section>

        <section className="ss-section">
          <label className="ss-section-label">Depth</label>
          <div className="ss-depth-row">
            {DEPTHS.map((d) => (
              <button
                key={d}
                type="button"
                className={
                  'ss-tile' + (selectedDepth === d ? ' is-selected' : '')
                }
                onClick={() => setSelectedDepth(d)}
              >
                {d}
              </button>
            ))}
          </div>
        </section>

        {errorMessage && <p className="ss-err">{errorMessage}</p>}
      </div>

      <div className="ss-footer">
        <button
          type="button"
          className="ss-btn-primary"
          disabled={!canGenerate}
          onClick={() =>
            run({
              courseId: selectedCourseId!,
              providers: selectedProviders,
              format: selectedFormat,
              depth: selectedDepth,
              includePage,
            })
          }
        >
          {status === 'extracting'
            ? 'Reading page…'
            : status === 'collecting'
              ? 'Collecting sources…'
              : status === 'generating'
                ? 'Generating…'
                : 'Generate'}
        </button>
      </div>
    </div>
  );
}

function CourseList({
  courses,
  selectedId,
  onSelect,
}: {
  courses: Course[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (courses.length === 0) {
    return <p className="ss-dim">No courses yet.</p>;
  }
  return (
    <div className="ss-course-list">
      {courses.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={
            'ss-course-row' + (selectedId === c.id ? ' is-selected' : '')
          }
        >
          <span className="ss-dot" style={{ backgroundColor: c.color }} />
          {c.code && <span className="ss-code">{c.code}</span>}
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Result rendering ----------

interface ResultData {
  request_id: string;
  cache_hit: boolean;
  output_format: string;
  depth: string;
  output: Record<string, unknown>;
  sources_used_count: number;
}

function ResultView({
  result,
  onBack,
}: {
  result: ResultData;
  onBack: () => void;
}) {
  return (
    <div className="ss-panel">
      <div className="ss-header">
        <span className="ss-logo">☥ StudySync</span>
        <button type="button" className="ss-btn-outline" onClick={onBack}>
          ← Back
        </button>
      </div>
      <div className="ss-content">
        <h2 className="ss-h2">
          {result.output_format.replace('_', ' ')} · {result.depth}
        </h2>
        <FormatRenderer
          format={result.output_format}
          output={result.output}
        />
        <p className="ss-dim">
          {result.cache_hit ? 'Returned from cache.' : 'Freshly generated.'} ·{' '}
          {result.sources_used_count} source(s) cited
        </p>
        <div className="ss-actions">
          <button
            type="button"
            className="ss-btn-primary"
            onClick={async () => {
              await navigator.clipboard.writeText(
                toMarkdown(result.output_format, result.output),
              );
            }}
          >
            Copy markdown
          </button>
          <button
            type="button"
            className="ss-btn-outline"
            onClick={async () => {
              await navigator.clipboard.writeText(
                JSON.stringify(result.output, null, 2),
              );
            }}
          >
            Copy JSON
          </button>
          <button
            type="button"
            className="ss-btn-outline"
            onClick={async () => {
              const app = await getAppBase();
              chrome.tabs.create({ url: `${app}/vault` });
            }}
          >
            Vault
          </button>
        </div>
      </div>
    </div>
  );
}

function FormatRenderer({
  format,
  output,
}: {
  format: string;
  output: Record<string, unknown>;
}) {
  if (format === 'flashcards') return <Flashcards output={output} />;
  if (format === 'study_guide') return <StudyGuide output={output} />;
  if (format === 'notes') return <Notes output={output} />;
  if (format === 'practice_questions') return <PracticeQs output={output} />;
  if (format === 'summary') return <Summary output={output} />;
  if (format === 'mind_map') return <MindMap output={output} />;
  return <pre className="ss-result-pre">{JSON.stringify(output, null, 2)}</pre>;
}

function Flashcards({ output }: { output: Record<string, unknown> }) {
  const cards = Array.isArray(output.cards)
    ? (output.cards as Array<{ front?: string; back?: string; topic?: string }>)
    : [];
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  if (cards.length === 0) return <p className="ss-dim">No cards.</p>;
  const card = cards[index];
  return (
    <div>
      <div className="ss-card-stack" onClick={() => setFlipped((f) => !f)}>
        <div className="ss-card-face">
          {card.topic && <div className="ss-card-topic">{card.topic}</div>}
          <div className="ss-card-text">{flipped ? card.back : card.front}</div>
          <div className="ss-card-hint">{flipped ? 'BACK' : 'FRONT'} · click to flip</div>
        </div>
      </div>
      <div className="ss-card-nav">
        <button
          type="button"
          className="ss-btn-outline"
          disabled={index === 0}
          onClick={() => {
            setIndex((i) => i - 1);
            setFlipped(false);
          }}
        >
          ←
        </button>
        <span className="ss-dim">
          {index + 1} / {cards.length}
        </span>
        <button
          type="button"
          className="ss-btn-outline"
          disabled={index >= cards.length - 1}
          onClick={() => {
            setIndex((i) => i + 1);
            setFlipped(false);
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

function StudyGuide({ output }: { output: Record<string, unknown> }) {
  const title = typeof output.title === 'string' ? output.title : '';
  const sections = Array.isArray(output.sections)
    ? (output.sections as Array<{
        heading?: string;
        body?: string;
        key_terms?: string[];
      }>)
    : [];
  const summary = typeof output.summary === 'string' ? output.summary : '';
  return (
    <div className="ss-prose">
      {title && <h3 className="ss-h2">{title}</h3>}
      {sections.map((s, i) => (
        <div key={i} className="ss-prose-section">
          {s.heading && <h4 className="ss-prose-heading">{s.heading}</h4>}
          {s.body && <p className="ss-prose-body">{s.body}</p>}
          {Array.isArray(s.key_terms) && s.key_terms.length > 0 && (
            <div className="ss-chip-row">
              {s.key_terms.map((t, j) => (
                <span key={j} className="ss-chip">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
      {summary && (
        <div className="ss-prose-section">
          <h4 className="ss-prose-heading">Summary</h4>
          <p className="ss-prose-body">{summary}</p>
        </div>
      )}
    </div>
  );
}

function Notes({ output }: { output: Record<string, unknown> }) {
  const title = typeof output.title === 'string' ? output.title : '';
  const cues = Array.isArray(output.cue_column)
    ? (output.cue_column as string[])
    : [];
  const notes = typeof output.notes_column === 'string' ? output.notes_column : '';
  const summary = typeof output.summary === 'string' ? output.summary : '';
  return (
    <div className="ss-prose">
      {title && <h3 className="ss-h2">{title}</h3>}
      <div className="ss-cornell">
        <div className="ss-cornell-cues">
          {cues.map((c, i) => (
            <div key={i} className="ss-cornell-cue">
              {c}
            </div>
          ))}
        </div>
        <div className="ss-cornell-notes">{notes}</div>
      </div>
      {summary && (
        <div className="ss-cornell-summary">
          <strong>Summary.</strong> {summary}
        </div>
      )}
    </div>
  );
}

function PracticeQs({ output }: { output: Record<string, unknown> }) {
  const questions = Array.isArray(output.questions)
    ? (output.questions as Array<{
        question?: string;
        answer?: string;
        difficulty?: string;
        topic?: string;
      }>)
    : [];
  return (
    <ol className="ss-pq">
      {questions.map((q, i) => (
        <li key={i} className="ss-pq-item">
          <details>
            <summary>
              <span className="ss-pq-num">Q{i + 1}.</span> {q.question}
              {q.difficulty && (
                <span className="ss-chip ss-chip-sm">{q.difficulty}</span>
              )}
            </summary>
            <div className="ss-pq-answer">{q.answer}</div>
          </details>
        </li>
      ))}
    </ol>
  );
}

function Summary({ output }: { output: Record<string, unknown> }) {
  const headline = typeof output.headline === 'string' ? output.headline : '';
  const keyPoints = Array.isArray(output.key_points)
    ? (output.key_points as string[])
    : [];
  const detail = typeof output.detail === 'string' ? output.detail : '';
  return (
    <div className="ss-prose">
      {headline && <h3 className="ss-h2">{headline}</h3>}
      {keyPoints.length > 0 && (
        <ul className="ss-bullets">
          {keyPoints.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
      {detail && <p className="ss-prose-body">{detail}</p>}
    </div>
  );
}

interface MindMapNode {
  concept?: string;
  children?: MindMapNode[];
}

function MindMap({ output }: { output: Record<string, unknown> }) {
  const root = output.root as MindMapNode | undefined;
  if (!root) return <p className="ss-dim">Empty mind map.</p>;
  return (
    <div className="ss-prose">
      <MindMapBranch node={root} depth={0} />
    </div>
  );
}

function MindMapBranch({ node, depth }: { node: MindMapNode; depth: number }) {
  return (
    <div className="ss-mm-branch" style={{ paddingLeft: depth * 12 }}>
      <div className="ss-mm-node">
        {depth === 0 ? '◉' : '·'} {node.concept ?? ''}
      </div>
      {(node.children ?? []).map((child, i) => (
        <MindMapBranch key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

// ---------- Markdown converter for Copy markdown ----------

function toMarkdown(format: string, output: Record<string, unknown>): string {
  if (format === 'flashcards') {
    const cards = Array.isArray(output.cards) ? (output.cards as Array<{ front?: string; back?: string }>) : [];
    return cards.map((c, i) => `### Card ${i + 1}\n**Q:** ${c.front ?? ''}\n\n**A:** ${c.back ?? ''}`).join('\n\n');
  }
  if (format === 'study_guide') {
    const title = typeof output.title === 'string' ? `# ${output.title}\n\n` : '';
    const sections = Array.isArray(output.sections)
      ? (output.sections as Array<{ heading?: string; body?: string; key_terms?: string[] }>)
      : [];
    return (
      title +
      sections
        .map(
          (s) =>
            `## ${s.heading ?? ''}\n\n${s.body ?? ''}${
              Array.isArray(s.key_terms) && s.key_terms.length
                ? `\n\n_Key terms:_ ${s.key_terms.join(', ')}`
                : ''
            }`,
        )
        .join('\n\n') +
      (typeof output.summary === 'string' ? `\n\n## Summary\n\n${output.summary}` : '')
    );
  }
  if (format === 'notes') {
    const cues = Array.isArray(output.cue_column) ? (output.cue_column as string[]).join('\n- ') : '';
    return `# ${output.title ?? 'Notes'}\n\n## Cues\n- ${cues}\n\n## Notes\n\n${output.notes_column ?? ''}\n\n## Summary\n\n${output.summary ?? ''}`;
  }
  if (format === 'practice_questions') {
    const qs = Array.isArray(output.questions)
      ? (output.questions as Array<{ question?: string; answer?: string }>)
      : [];
    return qs.map((q, i) => `${i + 1}. ${q.question ?? ''}\n\n   **Answer:** ${q.answer ?? ''}`).join('\n\n');
  }
  if (format === 'summary') {
    const points = Array.isArray(output.key_points) ? (output.key_points as string[]) : [];
    return `# ${output.headline ?? 'Summary'}\n\n${points.map((p) => `- ${p}`).join('\n')}\n\n${output.detail ?? ''}`;
  }
  if (format === 'mind_map') {
    const root = output.root as MindMapNode | undefined;
    if (!root) return '';
    const lines: string[] = [];
    const walk = (n: MindMapNode, depth: number) => {
      lines.push(`${'  '.repeat(depth)}- ${n.concept ?? ''}`);
      (n.children ?? []).forEach((c) => walk(c, depth + 1));
    };
    walk(root, 0);
    return lines.join('\n');
  }
  return JSON.stringify(output, null, 2);
}
