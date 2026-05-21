'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Settings, KeyRound, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

export interface UserMenuProps {
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export function UserMenu({ email, displayName, avatarUrl }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const initial = (displayName ?? email).charAt(0).toUpperCase();

  const signOut = async () => {
    const res = await fetch('/api/auth/signout', { method: 'POST' });
    if (!res.ok) {
      toast.error('Sign out failed');
      return;
    }
    router.push('/login');
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-2 rounded-md brutal-border brutal-shadow bg-popover p-1.5 z-20">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <Link
            href="/api-keys"
            className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-muted"
            onClick={() => setOpen(false)}
          >
            <KeyRound className="h-4 w-4" /> API keys
          </Link>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md brutal-border bg-card p-2 text-left press hover:bg-muted/50"
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 rounded-sm brutal-border object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-sm brutal-border bg-accent text-sm font-bold text-accent-foreground">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-xs font-bold">{displayName ?? 'Account'}</div>
          <div className="truncate text-[10px] text-muted-foreground">{email}</div>
        </div>
        <ChevronUp
          className={`h-4 w-4 shrink-0 transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </button>
    </div>
  );
}
