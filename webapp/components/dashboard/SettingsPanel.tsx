'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';

export interface Preferences {
  default_format: string;
  default_depth: string;
  auto_scan_page: boolean;
  cache_outputs: boolean;
  spaced_repetition: boolean;
}

export interface ProfileInfo {
  email: string;
  display_name: string | null;
  plan: string;
}

export function SettingsPanel({
  profile,
  initialPreferences,
}: {
  profile: ProfileInfo;
  initialPreferences: Preferences;
}) {
  const [prefs, setPrefs] = useState(initialPreferences);
  const [saving, setSaving] = useState(false);

  const update = async (patch: Partial<Preferences>) => {
    const previous = prefs;
    setPrefs({ ...prefs, ...patch });
    setSaving(true);
    try {
      await api.updatePreferences(patch);
    } catch {
      toast.error('Failed to update preference');
      setPrefs(previous);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Email: </span>
            {profile.email}
          </div>
          <div>
            <span className="text-muted-foreground">Name: </span>
            {profile.display_name ?? '—'}
          </div>
          <div>
            <span className="text-muted-foreground">Plan: </span>
            {profile.plan}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ToggleRow
            label="Auto-scan current page"
            checked={prefs.auto_scan_page}
            onChange={(v) => update({ auto_scan_page: v })}
            disabled={saving}
          />
          <ToggleRow
            label="Cache generated outputs"
            checked={prefs.cache_outputs}
            onChange={(v) => update({ cache_outputs: v })}
            disabled={saving}
          />
          <ToggleRow
            label="Spaced repetition (experimental)"
            checked={prefs.spaced_repetition}
            onChange={(v) => update({ spaced_repetition: v })}
            disabled={saving}
          />
        </CardContent>
      </Card>

      <DangerZone />
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
    </label>
  );
}

function DangerZone() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const handleDelete = async () => {
    if (text !== 'DELETE') {
      toast.error('Type DELETE to confirm');
      return;
    }
    setBusy(true);
    // Sign out client-side. Actual account deletion is left to the user via
    // Supabase dashboard for MVP. A future iteration could call an admin
    // endpoint that calls supabase.auth.admin.deleteUser.
    await fetch('/api/auth/signout', { method: 'POST' }).catch(() => undefined);
    toast.message(
      'Account deletion requested. Contact support to permanently remove data.',
    );
    setBusy(false);
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">Danger zone</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Type <code className="font-mono">DELETE</code> below and submit to
          request account deletion.
        </p>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-40 rounded-md border bg-background px-2 py-1 text-sm"
        />
        <div>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy || text !== 'DELETE'}
            onClick={handleDelete}
          >
            Delete account
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
