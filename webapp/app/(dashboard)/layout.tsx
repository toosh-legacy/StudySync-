import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { api } from '@/lib/api-client.server';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { PageTransition } from '@/components/motion/PageTransition';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Supabase cookie session is the auth gate. Profile data comes from the API.
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  let displayName: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const profile = await api.getProfile();
    displayName = profile.display_name;
    avatarUrl = profile.avatar_url;
  } catch {
    // Non-fatal: fall back to email-only rendering in the sidebar.
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{
          email: data.user.email ?? '',
          displayName,
          avatarUrl,
        }}
      />
      <main className="flex-1 overflow-y-auto bg-background">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  );
}
