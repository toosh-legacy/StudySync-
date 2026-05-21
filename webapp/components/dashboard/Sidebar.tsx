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
  KeyRound,
} from 'lucide-react';
import { UserMenu, type UserMenuProps } from './UserMenu';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vault', label: 'Vault', icon: Library },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/connections', label: 'Connections', icon: Cable },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/api-keys', label: 'API Keys', icon: KeyRound },
];

export function Sidebar({ user }: { user: UserMenuProps }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r-2 md:border-foreground md:bg-sidebar">
      <div className="flex h-16 items-center px-5 brutal-border-thick border-x-0 border-t-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xl font-black uppercase tracking-wider"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-sm brutal-border bg-accent text-base text-accent-foreground">
            ☥
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
                'group relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-semibold transition-all',
                active
                  ? 'bg-card brutal-border brutal-shadow-sm translate-x-[-1px] translate-y-[-1px]'
                  : 'text-sidebar-foreground/80 hover:bg-card hover:brutal-border hover:translate-x-[-1px] hover:translate-y-[-1px]',
              )}
            >
              {active && (
                <span className="absolute -left-1.5 top-1/2 h-6 w-1.5 -translate-y-1/2 bg-accent" />
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
