'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  GoogleDriveIcon,
  NotionIcon,
  CanvasIcon,
  MoodleIcon,
  ObsidianIcon,
} from '@/components/icons/providers';
import { api, ApiError } from '@/lib/api-client';

export type Provider =
  | 'google_drive'
  | 'notion'
  | 'canvas'
  | 'moodle'
  | 'obsidian';

export interface ConnectionStatus {
  provider: Provider;
  connected: boolean;
  display_name: string | null;
  detail_label: string | null;
}

const PROVIDER_META: Record<
  Provider,
  {
    name: string;
    description: string;
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }
> = {
  google_drive: {
    name: 'Google Drive',
    description: 'Pull plain-text files and Google Docs',
    Icon: GoogleDriveIcon,
  },
  notion: {
    name: 'Notion',
    description: 'Sync pages and blocks from your workspace',
    Icon: NotionIcon,
  },
  canvas: {
    name: 'Canvas LMS',
    description: 'Read course pages via your personal access token',
    Icon: CanvasIcon,
  },
  moodle: {
    name: 'Moodle',
    description: 'Read course pages via a Web Service token',
    Icon: MoodleIcon,
  },
  obsidian: {
    name: 'Obsidian',
    description: 'Paste vault markdown content',
    Icon: ObsidianIcon,
  },
};

export function ProviderCard({ status }: { status: ConnectionStatus }) {
  const meta = PROVIDER_META[status.provider];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const handleOAuth = async () => {
    setBusy(true);
    try {
      if (status.provider !== 'google_drive' && status.provider !== 'notion') {
        toast.error('This provider does not use OAuth');
        return;
      }
      const { redirect_url } = await api.connectOAuth(status.provider);
      window.location.href = redirect_url;
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to start OAuth');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Disconnect ${meta.name}?`)) return;
    setBusy(true);
    try {
      await api.disconnectProvider(status.provider);
      toast.success(`${meta.name} disconnected`);
      startTransition(() => router.refresh());
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setBusy(false);
    }
  };

  const { Icon } = meta;
  return (
    <Card>
      <CardContent className="flex items-start gap-4 p-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sm brutal-border bg-background">
          <Icon className="h-7 w-7" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wide">{meta.name}</span>
            {status.connected ? (
              <Badge variant="accent">Connected</Badge>
            ) : (
              <Badge variant="outline">Idle</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {status.connected
              ? status.detail_label ?? status.display_name ?? meta.description
              : meta.description}
          </p>
          <div className="mt-3 flex gap-2">
            {status.connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={busy || pending}
              >
                Disconnect
              </Button>
            ) : status.provider === 'google_drive' ||
              status.provider === 'notion' ? (
              <Button size="sm" onClick={handleOAuth} disabled={busy}>
                Connect
              </Button>
            ) : status.provider === 'canvas' ? (
              <CanvasDialog onConnected={() => router.refresh()} />
            ) : status.provider === 'moodle' ? (
              <MoodleDialog onConnected={() => router.refresh()} />
            ) : (
              <ObsidianDialog onConnected={() => router.refresh()} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CanvasDialog({ onConnected }: { onConnected: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.connectCanvas({ canvas_url: url, api_token: token });
      toast.success('Canvas connected');
      setOpen(false);
      onConnected();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to connect');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button size="sm" {...props}>
            Connect
          </Button>
        )}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Canvas</DialogTitle>
          <DialogDescription>
            Paste your Canvas base URL and a personal access token generated in
            Account → Settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="canvas-url">Canvas URL</Label>
            <Input
              id="canvas-url"
              type="url"
              placeholder="https://canvas.university.edu"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="canvas-token">Access token</Label>
            <Input
              id="canvas-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MoodleDialog({ onConnected }: { onConnected: () => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.connectMoodle({ moodle_url: url, web_service_token: token });
      toast.success('Moodle connected');
      setOpen(false);
      onConnected();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to connect');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button size="sm" {...props}>
            Connect
          </Button>
        )}
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Moodle</DialogTitle>
          <DialogDescription>
            Provide your Moodle site URL and a Web Service token.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="moodle-url">Moodle URL</Label>
            <Input
              id="moodle-url"
              type="url"
              placeholder="https://moodle.school.edu"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="moodle-token">Web Service token</Label>
            <Input
              id="moodle-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? 'Connecting…' : 'Connect'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ObsidianDialog({ onConnected }: { onConnected: () => void }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    try {
      await api.connectObsidian({ content });
      toast.success('Obsidian vault saved');
      setOpen(false);
      onConnected();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(props) => (
          <Button size="sm" {...props}>
            Paste vault
          </Button>
        )}
      />
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Paste Obsidian vault</DialogTitle>
          <DialogDescription>
            Up to 200,000 characters of combined markdown content.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={200_000}
            className="h-72 w-full rounded-md border bg-background p-3 font-mono text-xs"
            placeholder="# My note&#10;&#10;Content..."
            required
          />
          <p className="text-xs text-muted-foreground">
            {content.length.toLocaleString()} / 200,000 characters
          </p>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save vault'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
