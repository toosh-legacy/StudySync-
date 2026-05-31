'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Library,
  BookOpen,
  Cable,
  Settings,
  FileCode2,
} from 'lucide-react';
import { UserMenu, type UserMenuProps } from './UserMenu';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vault', label: 'Vault', icon: Library },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/connections', label: 'Connections', icon: Cable },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/api', label: 'API / Docs', icon: FileCode2 },
];

export function Sidebar({ user }: { user: UserMenuProps }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border md:bg-sidebar">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xl font-black tracking-tight"
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-base"
            style={{
              background: 'linear-gradient(150deg, var(--primary), var(--accent))',
              color: 'var(--primary-foreground)',
            }}
          >
            ◆
          </span>
          StudySync
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
                active
                  ? 'bg-primary/12 text-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-foreground/5 hover:text-foreground',
              )}
            >
              {active && (
                <span className="absolute -left-1 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary" />
              )}
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        <UserMenu {...user} />
      </div>
    </aside>
  );
}
