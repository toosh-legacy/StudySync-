import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { api } from '@/lib/api-client.server';
import {
  ApiKeysPanel,
  type ApiKey,
} from '@/components/dashboard/ApiKeysPanel';

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  let keys: ApiKey[] = [];
  try {
    keys = await api.listKeys();
  } catch {
    keys = [];
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tight">API keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create keys for non-browser clients (CLI, extension, scripts).
        </p>
      </div>
      <ApiKeysPanel initialKeys={keys} />
    </div>
  );
}
