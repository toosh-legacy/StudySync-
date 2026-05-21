import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';

export const metadata = {
  title: 'Lost in the sands · StudySync',
};

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="texture-grain absolute inset-0 opacity-60 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-sm brutal-border brutal-shadow-lg bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm brutal-border bg-accent text-3xl text-accent-foreground">
            ☥
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            404
          </p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-tight">
            Lost in the sands
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            That page doesn&apos;t exist — or it never did. Back to the temple.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: 'default', size: 'default' })}
            >
              Dashboard →
            </Link>
            <Link
              href="/"
              className={buttonVariants({ variant: 'outline', size: 'default' })}
            >
              Landing page
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
