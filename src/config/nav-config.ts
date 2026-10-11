import { NavGroup } from '@/types';

/** Shared route map for the Kiranism sidebar and Cmd+K palette. Role labels are
 * preview-only; API authorization is always enforced by Supabase-backed checks. */
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
  },
  {
    label: 'University operations',
    items: [
      {
        title: 'Case queue',
        url: '/dashboard/cases',
        icon: 'workspace',
        shortcut: ['c', 'q'],
        items: []
      },
      {
        title: 'Claim review',
        url: '/dashboard/claims',
        icon: 'badgeCheck',
        shortcut: ['c', 'l'],
        items: []
      },
      {
        title: 'Institution overview',
        url: '/dashboard/institution',
        icon: 'teams',
        shortcut: ['i', 'i'],
        items: []
      }
    ]
  },
  {
    label: 'Platform',
    items: [
      {
        title: 'Platform overview',
        url: '/dashboard/platform',
        icon: 'laptop',
        shortcut: ['p', 'o'],
        items: []
      }
    ]
  }
];
