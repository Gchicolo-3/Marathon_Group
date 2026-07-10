'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '../lib/utils';

const ITEMS = [
  { label: 'Dashboard', href: '/' },
  { label: 'Pipeline', href: '/pipeline' },
  { label: 'Approval Queue', href: '/queue' },
  { label: 'Signals', href: '/signals' },
  { label: 'Activity', href: '/activity' },
  { label: 'Companies', href: '/companies' },
  { label: 'Contacts', href: '/contacts' },
  { label: 'Runs', href: '/runs' },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto">
      {ITEMS.map(({ label, href }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'whitespace-nowrap rounded-md px-3 py-[7px] text-[13px] transition-colors',
              active
                ? 'bg-[#5B8CFF]/10 font-semibold text-foreground'
                : 'font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground'
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
