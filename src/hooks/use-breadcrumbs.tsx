'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = { title: string; link: string };

const routeMapping: Record<string, BreadcrumbItem[]> = {
  '/dashboard': [{ title: 'Overview', link: '/dashboard/overview' }],
  '/dashboard/overview': [{ title: 'Overview', link: '/dashboard/overview' }],
  '/dashboard/search': [
    { title: 'Discover', link: '/dashboard/search' },
    { title: 'Search items', link: '/dashboard/search' }
  ],
  '/dashboard/report': [
    { title: 'Discover', link: '/dashboard/search' },
    { title: 'Report an item', link: '/dashboard/report' }
  ],
  '/dashboard/account': [
    { title: 'My account', link: '/dashboard/account' },
    { title: 'My reports & claims', link: '/dashboard/account' }
  ],
  '/dashboard/cases': [
    { title: 'University operations', link: '/dashboard/cases' },
    { title: 'Case queue', link: '/dashboard/cases' }
  ],
  '/dashboard/claims': [
    { title: 'University operations', link: '/dashboard/claims' },
    { title: 'Claim review', link: '/dashboard/claims' }
  ],
  '/dashboard/institution': [
    { title: 'University operations', link: '/dashboard/institution' },
    { title: 'Institution overview', link: '/dashboard/institution' }
  ],
  '/dashboard/platform': [
    { title: 'Platform', link: '/dashboard/platform' },
    { title: 'Platform overview', link: '/dashboard/platform' }
  ]
};

export function useBreadcrumbs() {
  const pathname = usePathname();
  return useMemo(() => {
    if (routeMapping[pathname]) return routeMapping[pathname];
    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => ({
      title: segment.replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()),
      link: `/${segments.slice(0, index + 1).join('/')}`
    }));
  }, [pathname]);
}
