import Link from 'next/link';
import { api } from '@/lib/api-client.server';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { VaultDetailButton } from '@/components/dashboard/VaultDetail';

export const dynamic = 'force-dynamic';

const FORMAT_LABEL: Record<string, string> = {
  flashcards: 'Flashcards',
  study_guide: 'Study guide',
  notes: 'Notes',
  practice_questions: 'Practice questions',
  summary: 'Summary',
  mind_map: 'Mind map',
};

export default async function VaultPage() {
  const [vault, courses] = await Promise.all([
    api.listVault({ limit: 50 }).catch(() => ({ items: [] as Awaited<ReturnType<typeof api.listVault>>['items'] })),
    api.listCourses().catch(() => []),
  ]);

  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const items = vault.items;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tight">Vault</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every output you have generated.
        </p>
      </div>

      {items.length === 0 ? (
        <Card className="brutal-shadow">
          <CardContent className="flex flex-col items-start gap-4 p-8">
            <div className="text-3xl">☥</div>
            <div>
              <p className="text-base font-bold uppercase tracking-tight">
                Nothing in the vault yet.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Generate from the StudySync extension to fill this up.
              </p>
            </div>
            <Link
              href="/connections"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              Connect a source first →
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const course = item.course_id ? courseMap.get(item.course_id) : null;
            return (
              <li key={item.id}>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {FORMAT_LABEL[item.output_format] ?? item.output_format}
                      </Badge>
                      <Badge variant="outline">{item.depth}</Badge>
                    </div>
                    {course && (
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: course.color }}
                        />
                        <span className="text-sm">
                          {course.code ? `${course.code} · ` : ''}
                          {course.name}
                        </span>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.sources_used_count} source
                      {item.sources_used_count === 1 ? '' : 's'} ·{' '}
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                    <div className="mt-3">
                      <VaultDetailButton id={item.id} />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
