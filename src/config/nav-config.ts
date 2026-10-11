import { NavGroup } from '@/types';

/** Shared route map for the Kiranism sidebar and Cmd+K palette. Role labels are
 * preview-only; API authorization is always enforced by PostgreSQL-backed sessions and membership checks. */
export const navGroups: NavGroup[] = [
  {
    label: 'Discover',
    items: [
      {
        title: 'Overview',
        url: '/dashboard/overview',
        icon: 'dashboard',
        shortcut: ['d', 'd'],
        items: []
      },
      {
        title: 'Search items',
        url: '/dashboard/search',
        icon: 'search',
        shortcut: ['s', 's'],
        items: []
      },
      {
        title: 'Report an item',
        url: '/dashboard/report',
        icon: 'post',
        shortcut: ['r', 'r'],
        items: []
      }
    ]
  },
  {
    label: 'My account',
    items: [
      {
        title: 'My reports & claims',
        url: '/dashboard/account',
        icon: 'account',
        shortcut: ['m', 'm'],
        items: []
      }
    ]
  }
];
