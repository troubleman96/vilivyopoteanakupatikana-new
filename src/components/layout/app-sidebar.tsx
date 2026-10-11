'use client';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail
} from '@/components/ui/sidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { navGroups } from '@/config/nav-config';
import { useFilteredNavGroups } from '@/hooks/use-nav';
import { Icons } from '@/components/icons';
import { useDemoRole, type DemoRole } from '@/components/vilivyopotea/role-context';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

const roles: { id: DemoRole; label: string; description: string }[] = [
  { id: 'individual', label: 'Individual', description: 'Personal reports and claims' },
  { id: 'staff', label: 'Security / staff reviewer', description: 'Institution cases and returns' },
  { id: 'institution', label: 'Institution admin', description: 'One synthetic institution' },
  { id: 'platform', label: 'System admin', description: 'Cross-institution aggregate preview' }
];

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const filteredGroups = useFilteredNavGroups(navGroups);
  const { role, setRole } = useDemoRole();
  const activeRole = roles.find((candidate) => candidate.id === role) ?? roles[1];

  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader className='gap-3 border-b border-sidebar-border px-3 py-3'>
        <Link
          href='/'
          className='flex min-w-0 items-center gap-3 rounded-lg px-1 py-1.5'
          aria-label='Vilivyopotea na Kupatikana home'
        >
          <span className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground'>
            V
          </span>
          <span className='min-w-0 group-data-[collapsible=icon]:hidden'>
            <span className='block truncate text-sm font-semibold tracking-tight'>
              Vilivyopotea
            </span>
            <span className='block truncate text-[10px] text-muted-foreground'>na Kupatikana</span>
          </span>
        </Link>
        <div className='group-data-[collapsible=icon]:hidden'>
          <div className='mb-1.5 flex items-center justify-between px-1'>
            <label htmlFor='demo-role' className='text-[10px] font-medium text-muted-foreground'>
              Preview role
            </label>
            <span className='rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary'>
              Synthetic
            </span>
          </div>
          <Select
            items={roles.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
            value={role}
            onValueChange={(value) => {
              if (value !== null) setRole(value as DemoRole);
            }}
          >
            <SelectTrigger
              id='demo-role'
              className='h-9 w-full bg-background text-xs'
              aria-label='Choose a synthetic role preview'
            >
              <SelectValue placeholder='Choose preview role' />
            </SelectTrigger>
            <SelectContent align='start'>
              {roles.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='mt-1.5 px-1 text-[10px] leading-relaxed text-muted-foreground'>
            {activeRole.description}. Preview only; this does not grant access.
          </p>
        </div>
      </SidebarHeader>

      <SidebarContent className='overflow-x-hidden'>
        {filteredGroups.map((group) => (
          <SidebarGroup key={group.label || 'ungrouped'} className='py-1'>
            {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon ? Icons[item.icon] : Icons.logo;
                const active =
                  pathname === item.url ||
                  (item.url === '/dashboard/overview' && pathname === '/dashboard');
                return item.items && item.items.length > 0 ? (
                  <Collapsible
                    key={item.title}
                    defaultOpen={item.isActive}
                    render={<SidebarMenuItem />}
                  >
                    <CollapsibleTrigger
                      render={
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={active}
                          className='group/collapsible'
                        />
                      }
                    >
                      {item.icon && <Icon />}
                      <span>{item.title}</span>
                      <Icons.chevronRight className='ml-auto transition-transform duration-200 group-data-panel-open/collapsible:rotate-90' />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              render={<Link href={subItem.url} aria-label={subItem.title} />}
                              isActive={pathname === subItem.url}
                            >
                              <span>{subItem.title}</span>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                ) : (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      render={<Link href={item.url} aria-label={item.title} />}
                      tooltip={item.title}
                      isActive={active}
                    >
                      <Icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className='border-t border-sidebar-border'>
        <div className='group-data-[collapsible=icon]:hidden rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3'>
          <div className='flex items-center gap-2 text-xs font-semibold'>
            <Icons.badgeCheck className='size-4 text-primary' />
            People verify ownership
          </div>
          <p className='mt-1.5 text-[10px] leading-relaxed text-muted-foreground'>
            AI can offer suggestions; it never approves claims or decides returns.
          </p>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size='lg'
                    className='data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground'
                  />
                }
              >
                <span className='flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground'>
                  AJ
                </span>
                <span className='min-w-0 truncate text-left group-data-[collapsible=icon]:hidden'>
                  <span className='block text-xs font-medium'>Guest account</span>
                  <span className='block text-[10px] text-muted-foreground'>Supabase sign-in</span>
                </span>
                <Icons.chevronsDown className='ml-auto size-4 group-data-[collapsible=icon]:hidden' />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className='w-(--anchor-width) min-w-56 rounded-lg'
                side='top'
                align='end'
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className='p-0 font-normal'>
                    <div className='px-2 py-1.5'>
                      <p className='text-xs font-medium'>Your account</p>
                      <p className='text-[10px] text-muted-foreground'>
                        Sign in to manage private reports.
                      </p>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/auth/sign-in')}>
                  <Icons.login className='mr-2 size-4' />
                  Sign in
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/dashboard/account')}>
                  <Icons.account className='mr-2 size-4' />
                  My reports & claims
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/')}>
                  <Icons.externalLink className='mr-2 size-4' />
                  Public home
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
