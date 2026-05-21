'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Copy, Download, Link2, Trash2, Loader2 } from 'lucide-react';
import { OutputRenderer } from '@/components/vault/OutputRenderer';
import { toMarkdown, type OutputFormat } from '@/components/vault/formatters';
import { api } from '@/lib/api-client';

interface VaultDetailButtonProps {
  id: string;
  format?: OutputFormat;
  courseName?: string | null;
  depth?: string | null;
}

interface VaultOutput {
  id: string;
  output_format: OutputFormat;
  depth: string;
  output: Record<string, unknown>;
  sources_read: unknown;
  sources_used_count: number;
  cache_hit: boolean;
  public_share?: boolean;
  created_at: string;
}

export function VaultDetailButton(props: VaultDetailButtonProps) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<VaultOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const item = (await api.getVaultItem(props.id)) as unknown as VaultOutput;
      setData(item);
    } catch {
      toast.error('Failed to load output');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && !data) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const copyJson = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data.output, null, 2));
    toast.success('JSON copied');
  };

  const downloadMd = () => {
    if (!data) return;
    const md = toMarkdown(data.output, data.output_format, {
      course: props.courseName,
      depth: data.depth,
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.output_format}-${data.id.slice(0, 8)}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Markdown downloaded');
  };

  const toggleShare = async () => {
    if (!data) return;
    setShareBusy(true);
    try {
      const body = await api.setVaultShare(data.id, !data.public_share);
      setData({ ...data, public_share: body.public_share });
      if (body.public_share && body.share_url) {
        const fullUrl = `${window.location.origin}${body.share_url}`;
        await navigator.clipboard.writeText(fullUrl);
        toast.success('Public link copied to clipboard');
      } else {
        toast.success('Sharing disabled');
      }
    } catch {
      toast.error('Could not update share');
    } finally {
      setShareBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this output?')) return;
    try {
      await api.deleteVaultItem(props.id);
      toast.success('Output deleted');
      setOpen(false);
      location.reload();
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={(triggerProps) => (
          <Button size="sm" variant="outline" {...triggerProps}>
            Open
          </Button>
        )}
      />
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-auto scrollbar-brutal">
        <DialogHeader>
          <DialogTitle>
            {data?.output_format
              ? data.output_format.replace('_', ' ')
              : 'Output'}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">No data.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{data.depth}</Badge>
              <Badge variant="outline">
                {data.sources_used_count} sources
              </Badge>
              {data.cache_hit && <Badge variant="gold">cached</Badge>}
              {data.public_share && <Badge variant="accent">public</Badge>}
            </div>
            <OutputRenderer output={data.output} format={data.output_format} />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={downloadMd}>
                <Download className="h-4 w-4" /> Markdown
              </Button>
              <Button size="sm" variant="outline" onClick={copyJson}>
                <Copy className="h-4 w-4" /> JSON
              </Button>
              <Button
                size="sm"
                variant={data.public_share ? 'accent' : 'outline'}
                onClick={toggleShare}
                disabled={shareBusy}
              >
                <Link2 className="h-4 w-4" />
                {data.public_share ? 'Unshare' : 'Share link'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDelete}
                className="ml-auto"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
