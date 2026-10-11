'use client';

import AppSidebar from '@/components/layout/app-sidebar';
import Header from '@/components/layout/header';
import KBar from '@/components/kbar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { DemoNotice } from './primitives';
import Link from 'next/link';
import type { ReactNode } from 'react';

const LANDING_URL = process.env.NEXT_PUBLIC_LANDING_URL ?? 'http://localhost:3001';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href='/'
      className='inline-flex items-center gap-2.5'
      aria-label='Vilivyopotea na Kupatikana home'
    >
      <span className='flex size-9 items-center justify-center rounded-lg bg-primary text-base font-bold text-primary-foreground'>
        V
      </span>
      {!compact && (
        <span className='leading-tight'>
          <span className='block font-heading text-sm font-semibold tracking-tight'>
            Vilivyopotea
          </span>
          <span className='block text-[10px] text-muted-foreground'>na Kupatikana</span>
        </span>
      )}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <KBar>
      <SidebarProvider defaultOpen>
        <AppSidebar />
        <SidebarInset className='min-h-svh'>
          <Header />
          <main className='flex min-h-0 flex-1 flex-col'>
            <div className='mx-auto w-full max-w-screen-2xl flex-1 px-4 pb-8 pt-5 sm:px-6 sm:pt-7 lg:px-8'>
              {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && (
                <DemoNotice>
                  Fictional demo data only · No university has approved a pilot or endorsed this
                  concept.
                </DemoNotice>
              )}
              <div className='mt-6 sm:mt-8'>{children}</div>
            </div>
            <footer className='border-t border-border px-4 py-3 text-center text-[10px] text-muted-foreground sm:px-6'>
              <span>
                Private details stay private · Staff verify ownership · AI suggestions never make
                decisions
              </span>
              <span className='mx-2' aria-hidden>
                ·
              </span>
              <a className='font-semibold text-primary hover:underline' href={LANDING_URL}>
                About the project
              </a>
            </footer>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </KBar>
  );
}
