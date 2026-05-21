// Convert format-specific output objects to clean Markdown for download.

export type OutputFormat =
  | 'flashcards'
  | 'study_guide'
  | 'notes'
  | 'practice_questions'
  | 'summary'
  | 'mind_map';

export function toMarkdown(
  output: unknown,
  format: OutputFormat,
  meta: { course?: string | null; depth?: string | null } = {},
): string {
  const o = output as Record<string, unknown>;
  const header = [
    meta.course ? `> Course: ${meta.course}` : null,
    meta.depth ? `> Depth: ${meta.depth}` : null,
    `> Format: ${format}`,
    '',
  ]
    .filter(Boolean)
    .join('\n');

  switch (format) {
    case 'flashcards':
      return flashcardsMd(o, header);
    case 'study_guide':
      return studyGuideMd(o, header);
    case 'notes':
      return notesMd(o, header);
    case 'practice_questions':
      return practiceMd(o, header);
    case 'summary':
      return summaryMd(o, header);
    case 'mind_map':
      return mindMapMd(o, header);
    default:
      return `${header}\n\`\`\`json\n${JSON.stringify(output, null, 2)}\n\`\`\``;
  }
}

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function flashcardsMd(o: Record<string, unknown>, header: string) {
  const cards = asArray<{ front: string; back: string; topic?: string }>(o.cards);
  const body = cards
    .map(
      (c, i) =>
        `### ${i + 1}. ${c.topic ? `(${c.topic}) ` : ''}${c.front}\n\n> ${c.back}`,
    )
    .join('\n\n');
  return `# Flashcards\n\n${header}\n${body}\n`;
}

function studyGuideMd(o: Record<string, unknown>, header: string) {
  const title = (o.title as string) ?? 'Study guide';
  const sections = asArray<{
    heading: string;
    body: string;
    key_terms?: string[];
  }>(o.sections);
  const summary = (o.summary as string) ?? '';
  const body = sections
    .map(
      (s) =>
        `## ${s.heading}\n\n${s.body}${
          s.key_terms && s.key_terms.length
            ? `\n\n**Key terms:** ${s.key_terms.join(', ')}`
            : ''
        }`,
    )
    .join('\n\n');
  return `# ${title}\n\n${header}\n${body}\n\n---\n\n**Summary:** ${summary}\n`;
}

function notesMd(o: Record<string, unknown>, header: string) {
  const title = (o.title as string) ?? 'Notes';
  const cues = asArray<string>(o.cue_column);
  const notes = (o.notes_column as string) ?? '';
  const summary = (o.summary as string) ?? '';
  const cueList = cues.map((c) => `- ${c}`).join('\n');
  return `# ${title}\n\n${header}\n## Cues\n\n${cueList}\n\n## Notes\n\n${notes}\n\n---\n\n**Summary:** ${summary}\n`;
}

function practiceMd(o: Record<string, unknown>, header: string) {
  const questions = asArray<{
    question: string;
    answer: string;
    difficulty?: string;
    topic?: string;
  }>(o.questions);
  const body = questions
    .map((q, i) => {
      const tag = [q.topic, q.difficulty].filter(Boolean).join(' · ');
      return `### ${i + 1}. ${q.question}${tag ? `\n\n*${tag}*` : ''}\n\n<details>\n<summary>Answer</summary>\n\n${q.answer}\n\n</details>`;
    })
    .join('\n\n');
  return `# Practice questions\n\n${header}\n${body}\n`;
}

function summaryMd(o: Record<string, unknown>, header: string) {
  const headline = (o.headline as string) ?? '';
  const points = asArray<string>(o.key_points);
  const detail = (o.detail as string) ?? '';
  const bullets = points.map((p) => `- ${p}`).join('\n');
  return `# ${headline}\n\n${header}\n## Key points\n\n${bullets}\n\n## Detail\n\n${detail}\n`;
}

function mindMapMd(o: Record<string, unknown>, header: string) {
  const root = o.root as
    | { concept: string; children?: unknown[] }
    | undefined;
  if (!root) return `# Mind map\n\n${header}\n_No content_\n`;
  const rec = (node: { concept: string; children?: unknown[] }, depth: number): string => {
    const indent = '  '.repeat(depth);
    const line = `${indent}- ${node.concept}`;
    const kids = asArray<{ concept: string; children?: unknown[] }>(node.children);
    return [line, ...kids.map((k) => rec(k, depth + 1))].join('\n');
  };
  return `# Mind map: ${root.concept}\n\n${header}\n${rec(root, 0)}\n`;
}
