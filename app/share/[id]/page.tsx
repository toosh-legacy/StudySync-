import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client.server';
import { OutputRenderer } from '@/components/vault/OutputRenderer';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import type { OutputFormat } from '@/components/vault/formatters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const FORMAT_LABEL: Record<string, string> = {
  flashcards: 'Flashcards',
  study_guide: 'Study guide',
  notes: 'Notes',
  practice_questions: 'Practice questions',
  summary: 'Summary',
  mind_map: 'Mind map',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return {
    title: `Shared on StudySync · ${id.slice(0, 8)}`,
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let share: Awaited<ReturnType<typeof api.getShare>>;
  try {
    share = await api.getShare(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const courseLabel = share.course
    ? `${share.course.code ? `${share.course.code} · ` : ''}${share.course.name}`
    : null;

  return (
    <div className="min-h-screen bg-background texture-grain">
      <header className="border-b-2 border-foreground bg-card">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-black uppercase">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm brutal-border bg-accent text-base text-accent-foreground">
              ☥
            </span>
            StudySync
          </Link>
          <Link
            href="/login"
            className={buttonVariants({ size: 'sm', variant: 'accent' })}
          >
            Make your own
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant="default">
            {FORMAT_LABEL[share.output_format] ?? share.output_format}
          </Badge>
          <Badge variant="outline">{share.depth}</Badge>
          {courseLabel && <Badge variant="outline">{courseLabel}</Badge>}
          <span className="text-xs text-muted-foreground">
            shared {new Date(share.created_at).toLocaleDateString()}
          </span>
        </div>
        <OutputRenderer
          output={share.output as Record<string, unknown>}
          format={share.output_format as OutputFormat}
        />
      </main>

      <footer className="mt-12 border-t-2 border-foreground bg-card py-6">
        <div className="mx-auto max-w-4xl px-6 text-sm text-muted-foreground">
          Generated with{' '}
          <Link href="/" className="font-bold text-foreground underline underline-offset-2">
            StudySync
          </Link>{' '}
          — study material synthesised from your courses, notes, and tabs.
        </div>
      </footer>
    </div>
  );
}
