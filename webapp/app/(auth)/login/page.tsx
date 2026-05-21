import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OAuthButton } from '@/components/auth/OAuthButton';

export const metadata = {
  title: 'Sign in · StudySync',
};

const GOOGLE_SVG = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
    <path d="M21.35 11.1H12v3.2h5.35c-.23 1.4-1.55 4.1-5.35 4.1-3.22 0-5.85-2.66-5.85-5.95 0-3.29 2.63-5.95 5.85-5.95 1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.84 4.1 14.65 3.1 12 3.1 6.97 3.1 2.9 7.17 2.9 12.2c0 5.03 4.07 9.1 9.1 9.1 5.25 0 8.74-3.69 8.74-8.9 0-.6-.06-1.05-.14-1.5Z" fill="currentColor" />
  </svg>
);
const DISCORD_SVG = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
    <path d="M20 4.6a18 18 0 0 0-4.6-1.3l-.2.4a13.4 13.4 0 0 0-3.2 0l-.3-.4A18 18 0 0 0 7 4.6 19.7 19.7 0 0 0 3.3 17.5a18 18 0 0 0 5.4 2.7l.4-.6c-.7-.3-1.3-.6-1.9-1l.5-.4a13 13 0 0 0 11 0l.5.4-1.9 1 .4.6a18 18 0 0 0 5.4-2.7A19.7 19.7 0 0 0 20 4.6ZM9.7 15.2c-1 0-1.9-1-1.9-2.2 0-1.2.8-2.2 1.9-2.2 1 0 1.9 1 1.9 2.2 0 1.2-.9 2.2-1.9 2.2Zm4.6 0c-1 0-1.9-1-1.9-2.2 0-1.2.8-2.2 1.9-2.2 1 0 1.9 1 1.9 2.2 0 1.2-.9 2.2-1.9 2.2Z" fill="currentColor" />
  </svg>
);
const GITHUB_SVG = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
    <path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.4 6.8 9.7.5.1.7-.2.7-.5v-1.8c-2.8.6-3.4-1.4-3.4-1.4-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.2-4.6-5.1 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.7 1a9.3 9.3 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.8-4.6 5 .4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5A10.2 10.2 0 0 0 22 12.2C22 6.6 17.5 2 12 2Z" fill="currentColor" />
  </svg>
);

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ ext?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = params.ext === '1' ? '/extension/auth-complete' : params.next;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    redirect(next ?? '/dashboard');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="texture-grain absolute inset-0 opacity-60 pointer-events-none" />
      <div className="relative z-10 w-full max-w-sm">
        <Link
          href="/"
          className="mb-6 flex items-center justify-center gap-2 text-lg font-black uppercase tracking-wider"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-sm brutal-border bg-accent text-base text-accent-foreground">
            ☥
          </span>
          StudySync
        </Link>
        <div className="rounded-md brutal-border brutal-shadow-lg bg-card p-6">
          <h1 className="mb-1 text-2xl font-black uppercase tracking-tight">
            {params.ext === '1' ? 'Connect extension' : 'Sign in'}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {params.ext === '1'
              ? 'Sign in to authorise the StudySync browser extension.'
              : 'Use any provider. We never touch your password.'}
          </p>
          <div className="space-y-2.5">
            <OAuthButton
              provider="google"
              label="Continue with Google"
              icon={GOOGLE_SVG}
              next={next}
            />
            <OAuthButton
              provider="github"
              label="Continue with GitHub"
              icon={GITHUB_SVG}
              next={next}
            />
            <OAuthButton
              provider="discord"
              label="Continue with Discord"
              icon={DISCORD_SVG}
              next={next}
            />
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          by signing in you agree to study a little harder
        </p>
      </div>
    </main>
  );
}
