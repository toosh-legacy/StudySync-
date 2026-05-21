'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';

export function ConnectionToastBridge() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const status = params.get('status');
    const provider = params.get('connect');
    const message = params.get('message');
    if (!status || !provider) return;

    if (status === 'success') {
      toast.success(`${provider.replace('_', ' ')} connected`);
    } else {
      toast.error(message ?? `Failed to connect ${provider}`);
    }
    // Clear the query params after handling so refresh doesn't re-fire.
    router.replace('/connections');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
