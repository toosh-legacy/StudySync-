import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CodeBlock } from '@/components/docs/CodeBlock';

export const dynamic = 'force-dynamic';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://studysync-api-0lru.onrender.com';

const FORMATS = [
  ['flashcards', 'Q&A cards with topic tags'],
  ['study_guide', 'Sectioned guide with key terms + summary'],
  ['notes', 'Cornell-method notes (cue column + notes + summary)'],
  ['practice_questions', 'Mixed-difficulty questions with full answers'],
  ['summary', 'Headline + key points + detail paragraph'],
  ['mind_map', 'Hierarchical concept tree'],
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default async function ApiDocsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight">API</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Generate study material programmatically with a single HTTP request.
          You bring your own LLM API key — StudySync never sees, stores, or
          bills against it. There is nothing to sign up for: send your key plus
          your content and you get structured study output back.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs">
          <span className="text-muted-foreground">POST</span>
          <span className="text-foreground">{API_BASE}/v1/public/generate</span>
        </div>
      </header>

      <div className="space-y-12">
        <Section id="quickstart" title="1 · Quickstart">
          <p className="text-sm text-muted-foreground">
            One endpoint. One request. Pass your OpenAI API key in{' '}
            <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">
              llm_key
            </code>
            , the text you want to study in{' '}
            <code className="rounded bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">
              content
            </code>
            , and the format you want back.
          </p>
          <CodeBlock
            label="curl"
            code={`curl -X POST ${API_BASE}/v1/public/generate \\
  -H "Content-Type: application/json" \\
  -d '{
    "llm_key": "sk-...your-openai-key...",
    "content": "Mitochondria are the powerhouse of the cell. They generate ATP through oxidative phosphorylation...",
    "output_format": "flashcards",
    "depth": "standard"
  }'`}
          />
        </Section>

        <Section id="request" title="2 · Request body">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Field</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">llm_key</td>
                  <td className="px-4 py-2 font-mono text-xs">string</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    Required. Your OpenAI API key. Used only for this single
                    request; not stored.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">content</td>
                  <td className="px-4 py-2 font-mono text-xs">string</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    Required. The raw study material. Max 300,000 characters.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">output_format</td>
                  <td className="px-4 py-2 font-mono text-xs">enum</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    Required. One of the six formats below.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">depth</td>
                  <td className="px-4 py-2 font-mono text-xs">enum</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    Optional. <code>quick</code> · <code>standard</code> (default) ·{' '}
                    <code>deep</code>.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">user_prompt</td>
                  <td className="px-4 py-2 font-mono text-xs">string</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    Optional. Extra instructions (e.g. &quot;focus on chapter 3&quot;).
                    Max 1,000 chars.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-mono text-xs">model</td>
                  <td className="px-4 py-2 font-mono text-xs">string</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    Optional. OpenAI model id. Defaults to{' '}
                    <code>gpt-4o-mini</code>.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="formats" title="3 · Output formats">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {FORMATS.map(([name, desc]) => (
                <li key={name} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <code className="w-44 shrink-0 font-mono text-xs text-foreground">
                    {name}
                  </code>
                  <span className="text-xs text-muted-foreground">{desc}</span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="response" title="4 · Response">
          <CodeBlock
            label="200 OK"
            code={`{
  "output_format": "flashcards",
  "depth": "standard",
  "output": {
    "cards": [
      { "front": "What do mitochondria produce?", "back": "ATP via oxidative phosphorylation.", "topic": "Cell biology" }
    ],
    "total": 1
  },
  "usage": {
    "prompt_tokens": 312,
    "completion_tokens": 184,
    "total_tokens": 496,
    "model": "gpt-4o-mini"
  }
}`}
          />
          <p className="text-xs text-muted-foreground">
            The <code>output</code> shape varies by format. Errors return{' '}
            <code>{`{ error, message, status }`}</code> with the matching HTTP
            status — <code>401</code> for an invalid <code>llm_key</code>,{' '}
            <code>422</code> for validation, <code>503</code> if OpenAI is
            unreachable.
          </p>
        </Section>

        <Section id="node" title="5 · Node example">
          <CodeBlock
            label="fetch"
            code={`const res = await fetch("${API_BASE}/v1/public/generate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    llm_key: process.env.OPENAI_API_KEY,
    content: lectureNotes,
    output_format: "practice_questions",
    depth: "deep",
  }),
});
const { output } = await res.json();`}
          />
        </Section>
      </div>
    </div>
  );
}
