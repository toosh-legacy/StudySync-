import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { api } from '@/lib/api-client.server';
import {
  ProviderCard,
  type ConnectionStatus,
  type Provider,
} from '@/components/connections/ProviderCard';
import { ConnectionToastBridge } from '@/components/connections/ConnectionToastBridge';

export const dynamic = 'force-dynamic';

const ALL: Provider[] = [
  'google_drive',
  'notion',
  'canvas',
  'moodle',
  'obsidian',
];

export default async function ConnectionsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  let statuses: ConnectionStatus[];
  try {
    const rows = await api.listConnections();
    statuses = rows.map((r) => ({
      provider: r.provider,
      connected: r.connected,
      display_name: r.display_name,
      detail_label: r.detail_label,
    }));
  } catch {
    statuses = ALL.map((provider) => ({
      provider,
      connected: false,
      display_name: null,
      detail_label: null,
    }));
  }

  return (
    <div className="p-8">
      <Suspense fallback={null}>
        <ConnectionToastBridge />
      </Suspense>

      <div className="mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tight">Connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect the sources you want StudySync to pull from.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {statuses.map((status) => (
          <ProviderCard key={status.provider} status={status} />
        ))}
      </div>
    </div>
  );
}
