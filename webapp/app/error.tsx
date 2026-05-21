'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[ui error]', error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="texture-grain absolute inset-0 opacity-60 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-sm brutal-border brutal-shadow-lg bg-card p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-sm brutal-border bg-destructive text-2xl text-primary-foreground">
            !
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Something broke
          </p>
          <h1 className="mt-1 text-2xl font-black uppercase tracking-tight">
            The scribe stumbled.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred while rendering this page.'}
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              digest · {error.digest}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button onClick={reset}>Try again</Button>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: 'outline' })}
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
