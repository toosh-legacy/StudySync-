import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { api } from '@/lib/api-client.server';
import {
  SettingsPanel,
  type Preferences,
} from '@/components/dashboard/SettingsPanel';

export const dynamic = 'force-dynamic';

const DEFAULT_PREFS: Preferences = {
  default_format: 'flashcards',
  default_depth: 'standard',
  auto_scan_page: true,
  cache_outputs: true,
  spaced_repetition: false,
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');
  const user = userData.user;

  const [profileResult, prefsResult] = await Promise.allSettled([
    api.getProfile(),
    api.getPreferences(),
  ]);

  const profile =
    profileResult.status === 'fulfilled' ? profileResult.value : null;
  const prefsPayload =
    prefsResult.status === 'fulfilled' ? prefsResult.value : {};

  const prefs: Preferences = {
    default_format:
      prefsPayload.default_format ?? DEFAULT_PREFS.default_format,
    default_depth: prefsPayload.default_depth ?? DEFAULT_PREFS.default_depth,
    auto_scan_page:
      prefsPayload.auto_scan_page ?? DEFAULT_PREFS.auto_scan_page,
    cache_outputs:
      prefsPayload.cache_outputs ?? DEFAULT_PREFS.cache_outputs,
    spaced_repetition:
      prefsPayload.spaced_repetition ?? DEFAULT_PREFS.spaced_repetition,
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile and preferences.
        </p>
      </div>
      <SettingsPanel
        profile={{
          email: user.email ?? '',
          display_name: profile?.display_name ?? null,
          plan: profile?.plan ?? 'free',
        }}
        initialPreferences={prefs}
      />
    </div>
  );
}
