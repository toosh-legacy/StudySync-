import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { api } from '@/lib/api-client.server';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const FORMAT_LABEL: Record<string, string> = {
  flashcards: 'Flashcards',
  study_guide: 'Study guide',
  notes: 'Notes',
  practice_questions: 'Practice questions',
  summary: 'Summary',
  mind_map: 'Mind map',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const [stats, vault] = await Promise.all([
    api
      .getStats()
      .catch(() => ({
        generations_this_month: 0,
        courses: 0,
        connected_sources: 0,
        tokens_used_today: 0,
      })),
    api
      .listVault({ limit: 5 })
      .catch(() => ({ items: [] as Awaited<ReturnType<typeof api.listVault>>['items'] })),
  ]);

  const statCards = [
    { label: 'Generations this month', value: stats.generations_this_month },
    { label: 'Courses', value: stats.courses },
    { label: 'Connected sources', value: stats.connected_sources },
    { label: 'Tokens used today', value: stats.tokens_used_today.toLocaleString() },
  ];

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {userData.user.email}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 text-2xl font-black">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Recent outputs
        </h2>
        {vault.items.length === 0 ? (
          <Card className="brutal-shadow-sm">
            <CardContent className="flex flex-col items-start gap-3 p-6">
              <p className="text-sm font-bold uppercase tracking-tight">
                Your generations land here.
              </p>
              <p className="text-sm text-muted-foreground">
                Try the StudySync extension or hit the API directly.
              </p>
              <Link
                href="/connections"
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
              >
                Set up a source →
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-2">
            {vault.items.map((o) => (
              <li key={o.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {FORMAT_LABEL[o.output_format] ?? o.output_format}
                      </Badge>
                      <Badge variant="outline">{o.depth}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(o.created_at).toLocaleString()}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold uppercase tracking-tight">Use the extension</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Install the StudySync browser extension to generate study material
              while you read any page.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="font-bold uppercase tracking-tight">Connect more sources</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href="/connections" className="underline">
                Add Google Drive, Notion, Canvas, or Moodle →
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
