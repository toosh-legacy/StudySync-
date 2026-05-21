'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import type { Provider } from '@supabase/supabase-js';

interface OAuthButtonProps {
  provider: Provider;
  label: string;
  icon?: React.ReactNode;
  next?: string;
}

export function OAuthButton({ provider, label, icon, next }: OAuthButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    const supabase = createClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const callback = next
      ? `${appUrl}/api/auth/callback?next=${encodeURIComponent(next)}`
      : `${appUrl}/api/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callback },
    });
    if (error) {
      setLoading(false);
      console.error(`[oauth:${provider}]`, error.message);
    }
  };

  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full justify-start gap-3"
      onClick={handleClick}
      disabled={loading}
    >
      {icon}
      <span>{loading ? 'Redirecting…' : label}</span>
    </Button>
  );
}
