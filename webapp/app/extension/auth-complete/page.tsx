'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type Status = 'loading' | 'success' | 'no-session' | 'no-extension-id' | 'send-failed';

export default function ExtensionAuthCompletePage() {
  const [status, setStatus] = useState<Status>('loading');
  const [detail, setDetail] = useState<string>('');

  useEffect(() => {
    void (async () => {
      const extensionId = process.env.NEXT_PUBLIC_EXTENSION_ID;
      if (!extensionId) {
        setStatus('no-extension-id');
        setDetail(
          'NEXT_PUBLIC_EXTENSION_ID is not configured. Set it to the unpacked extension ID and reload.',
        );
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) {
        setStatus('no-session');
        setDetail('No active session. Sign in first, then revisit this page.');
        return;
      }

      const token = data.session.access_token;
      const apiBase = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

      try {
        await new Promise<void>((resolve, reject) => {
          const chromeRuntime = (
            window as unknown as {
              chrome?: {
                runtime?: {
                  sendMessage: (
                    id: string,
                    msg: unknown,
                    cb?: (resp: unknown) => void,
                  ) => void;
                  lastError?: { message?: string };
                };
              };
            }
          ).chrome?.runtime;
          if (!chromeRuntime) {
            reject(new Error('chrome.runtime not available'));
            return;
          }
          chromeRuntime.sendMessage(
            extensionId,
            { type: 'SET_TOKEN', token, api_base: apiBase },
            (resp) => {
              const lastErr = chromeRuntime.lastError;
              if (lastErr?.message) {
                reject(new Error(lastErr.message));
                return;
              }
              if (resp && typeof resp === 'object' && 'ok' in resp && resp.ok) {
                resolve();
              } else {
                reject(
                  new Error(
                    `Extension did not acknowledge: ${JSON.stringify(resp)}`,
                  ),
                );
              }
            },
          );
        });
        setStatus('success');
        setTimeout(() => window.close(), 1500);
      } catch (err) {
        setStatus('send-failed');
        setDetail(err instanceof Error ? err.message : 'unknown error');
      }
    })();
  }, []);

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="texture-grain absolute inset-0 opacity-60 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md rounded-md brutal-border brutal-shadow-lg bg-card p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-accent" />
            <h1 className="mt-4 text-xl font-black uppercase tracking-tight">
              Connecting…
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sending your session to the extension.
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="mx-auto h-12 w-12 text-accent" />
            <h1 className="mt-4 text-xl font-black uppercase tracking-tight">
              Extension connected
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You can close this tab. The extension popup is ready.
            </p>
          </>
        )}
        {status !== 'loading' && status !== 'success' && (
          <>
            <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
            <h1 className="mt-4 text-xl font-black uppercase tracking-tight">
              Could not connect
            </h1>
            <p className="mt-2 text-sm text-muted-foreground break-words">
              {detail}
            </p>
          </>
        )}
      </div>
    </main>
  );
}
