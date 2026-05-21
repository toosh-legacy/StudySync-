'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api, ApiError } from '@/lib/api-client';

export interface ApiKey {
  id: string;
  label: string;
  key_prefix: string;
  plan: string;
  usage_count: number;
  last_used_at: string | null;
  expires_at: string | null;
  revoked: boolean;
  created_at: string;
}

export function ApiKeysPanel({ initialKeys }: { initialKeys: ApiKey[] }) {
  const router = useRouter();
  const [keys, setKeys] = useState(initialKeys);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState<{ label: string; key: string } | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy(true);
    try {
      const created = await api.createKey(label.trim());
      setNewKey({ label: created.label, key: created.key });
      setKeys((prev) => [
        {
          id: created.id,
          label: created.label,
          key_prefix: created.key_prefix,
          plan: created.plan,
          usage_count: 0,
          last_used_at: null,
          expires_at: created.expires_at,
          revoked: false,
          created_at: created.created_at,
        },
        ...prev,
      ]);
      setLabel('');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to create key');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this API key? Existing clients using it will stop working.')) return;
    try {
      await api.revokeKey(id);
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, revoked: true } : k)),
      );
      toast.success('Key revoked');
    } catch {
      toast.error('Failed to revoke');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create API key</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="key-label">Label</Label>
              <Input
                id="key-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="My desktop client"
                maxLength={120}
                required
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Generate key'}
            </Button>
          </form>

          {newKey && (
            <div className="mt-4 rounded-md border border-amber-500/50 bg-amber-500/5 p-3">
              <p className="text-sm font-medium">
                Copy this key now — it will not be shown again.
              </p>
              <p className="mt-2 break-all rounded bg-background px-2 py-1 font-mono text-xs">
                {newKey.key}
              </p>
              <div className="mt-2 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(newKey.key);
                    toast.success('Copied');
                  }}
                >
                  Copy
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setNewKey(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          Your keys ({keys.length})
        </h2>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        ) : (
          <ul className="grid gap-2">
            {keys.map((k) => (
              <li key={k.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{k.label}</span>
                        {k.revoked && <Badge variant="destructive">Revoked</Badge>}
                        <Badge variant="outline">{k.plan}</Badge>
                      </div>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {k.key_prefix}…
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {k.usage_count.toLocaleString()} request
                        {k.usage_count === 1 ? '' : 's'} ·{' '}
                        {k.last_used_at
                          ? `last used ${new Date(k.last_used_at).toLocaleDateString()}`
                          : 'never used'}
                        {k.expires_at
                          ? ` · expires ${new Date(k.expires_at).toLocaleDateString()}`
                          : ''}
                      </p>
                    </div>
                    {!k.revoked && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revoke(k.id)}
                      >
                        Revoke
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
