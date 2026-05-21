'use client';

import { FlashcardDeck } from './FlashcardDeck';
import { QuizMode } from './QuizMode';
import { NotesCornell } from './NotesCornell';
import { StudyGuide } from './StudyGuide';
import { SummaryView } from './SummaryView';
import { MindMapTree } from './MindMapTree';
import type { OutputFormat } from './formatters';

export function OutputRenderer({
  output,
  format,
}: {
  output: Record<string, unknown>;
  format: OutputFormat;
}) {
  switch (format) {
    case 'flashcards':
      return <FlashcardDeck output={output} />;
    case 'practice_questions':
      return <QuizMode output={output} />;
    case 'notes':
      return <NotesCornell output={output} />;
    case 'study_guide':
      return <StudyGuide output={output} />;
    case 'summary':
      return <SummaryView output={output} />;
    case 'mind_map':
      return <MindMapTree output={output} />;
    default:
      return (
        <pre className="whitespace-pre-wrap rounded-md brutal-border bg-muted/30 p-3 text-xs">
          {JSON.stringify(output, null, 2)}
        </pre>
      );
  }
}
