'use client';

import Link from 'next/link';
import { BrandMark } from './app-shell';
import { Artwork, DemoNotice } from './primitives';
import { demoItems } from '@/lib/demo-data';
import { IconArrowRight, IconSearch, IconShieldCheck } from '@tabler/icons-react';

export function LandingPage() {
  const featured = demoItems[0];
  return <div className='min-h-screen bg-background text-foreground'>
    <header className='sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur'>
      <div className='mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-8'>
        <Link href='/'><BrandMark /></Link>
        <nav className='hidden items-center gap-7 text-xs font-medium text-muted-foreground lg:flex' aria-label='Main navigation'><a href='#how-it-works' className='hover:text-foreground'>How it works</a><Link href='/dashboard/search' className='hover:text-foreground'>Search items</Link><a href='#safety' className='hover:text-foreground'>Safety</a><Link href='/dashboard/overview' className='hover:text-foreground'>Demo workspaces</Link></nav>
        <div className='flex items-center gap-2'><Link href='/auth/sign-in' className='hidden rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted sm:inline-flex'>Sign in</Link><Link href='/dashboard/report' className='rounded-xl bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 sm:px-4'>Report an item</Link></div>
      </div>
    </header>
    <main>
      <section className='mx-auto grid max-w-7xl gap-10 px-4 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16'>
        <div>
          <div className='mb-5 inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.11em] text-secondary-foreground'><span className='size-1.5 rounded-full bg-primary' /> Free for individuals · Built for care</div>
          <h1 className='max-w-3xl text-[38px] font-bold leading-[1.08] tracking-[-0.045em] sm:text-[54px] lg:text-[62px]'>Lost something?<br />Found something?</h1>
          <p className='mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base'>A safer way for campus communities in Tanzania to reconnect people with their belongings. Search public listings, report an item, and let staff coordinate a careful return.</p>
          <div className='mt-7 flex flex-col gap-3 sm:flex-row'><Link href='/dashboard/search' className='inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90'><IconSearch size={17} /> Search items</Link><Link href='/dashboard/report' className='inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3.5 text-sm font-semibold hover:bg-muted'>Report an item <IconArrowRight size={16} /></Link></div>
          <div className='mt-6 flex items-center gap-2 text-[11px] text-muted-foreground'><IconShieldCheck size={15} className='text-primary' /> Private claims · Human-led verification · No public contact details</div>
        </div>
        <div className='relative rounded-[28px] border border-border bg-[#eaf3ed] p-4 dark:bg-emerald-950/40 sm:p-6'>
          <div className='absolute right-5 top-5 rounded-full border border-white/70 bg-white/80 px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-[#285644] dark:border-white/10 dark:bg-black/30 dark:text-emerald-100'>Safe, reviewed listing</div>
          <Artwork item={featured} className='h-[235px] w-full rounded-[22px] bg-gradient-to-br from-[#dcebe1] to-[#f3f3e7] text-[#547b69] dark:from-emerald-900 dark:to-slate-800 dark:text-emerald-200 sm:h-[290px]' />
          <div className='relative mx-2 -mt-5 rounded-2xl border border-border bg-card p-4 shadow-lg sm:mx-4 sm:p-5'>
            <div className='flex items-center justify-between'><span className='text-[10px] font-bold uppercase tracking-wider text-primary'>Found · reviewed</span><span className='text-[10px] text-muted-foreground'>VF-0248</span></div>
            <h2 className='mt-2 text-base font-bold'>Dark laptop sleeve</h2><p className='mt-1 text-xs text-muted-foreground'>Near a library area · Example University (Demo)</p>
            <div className='mt-4 flex items-center justify-between border-t border-border pt-3'><span className='text-[10px] text-muted-foreground'>Identifying details stay private</span><Link href='/dashboard/search?item=VF-0248' className='text-xs font-semibold text-primary'>See safe details →</Link></div>
          </div>
        </div>
      </section>
      <section className='mx-auto max-w-7xl px-4 pb-12 sm:px-8'>
        <div className='grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-4 sm:p-5'>
          {[['Free', 'for individual use'], ['Reviewed', 'public listings'], ['Private', 'claims and evidence'], ['Human-led', 'verification & returns']].map(([strong, text]) => <div key={strong} className='p-2'><p className='text-sm font-bold'>{strong}</p><p className='mt-1 text-[10px] text-muted-foreground sm:text-xs'>{text}</p></div>)}
        </div>
      </section>
      <section id='how-it-works' className='mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14'>
        <div className='mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end'><div><p className='text-[10px] font-bold uppercase tracking-[0.15em] text-primary'>A simple, careful process</p><h2 className='mt-2 text-2xl font-bold tracking-tight'>From report to return</h2></div><Link href='/dashboard/overview' className='text-xs font-semibold text-primary hover:underline'>Explore the demo workspaces →</Link></div>
        <div className='grid gap-3 md:grid-cols-3'>{[['01', 'Report safely', 'Share a general description, category, approximate area and date.'], ['02', 'Staff review', 'A reviewer checks the safe summary before any found item is published.'], ['03', 'Verify & return', 'Claims stay private. Staff check evidence and coordinate the handover.']].map(([number, title, text]) => <div key={number} className='rounded-2xl border border-border bg-card p-5'><span className='flex size-9 items-center justify-center rounded-xl bg-secondary text-xs font-bold text-secondary-foreground'>{number}</span><h3 className='mt-4 text-sm font-bold'>{title}</h3><p className='mt-2 text-xs leading-6 text-muted-foreground'>{text}</p></div>)}</div>
      </section>
      <section id='safety' className='mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-12'>
        <div className='grid gap-7 rounded-[26px] bg-[#102922] p-6 text-white sm:p-9 lg:grid-cols-[1fr_0.75fr] lg:items-center'>
          <div><p className='text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-200'>Trust comes first</p><h2 className='mt-3 max-w-xl text-2xl font-bold tracking-tight sm:text-3xl'>A possible match is a lead, never proof of ownership.</h2><p className='mt-3 max-w-xl text-sm leading-6 text-white/70'>Keep phone numbers, student IDs, serial numbers and unique identifying marks out of public descriptions. Staff verify claims and arrange returns.</p></div>
          <div className='space-y-3'><div className='rounded-2xl border border-white/10 bg-white/5 p-4'><div className='text-xs font-semibold'>AI only suggests</div><p className='mt-1 text-[11px] leading-5 text-white/65'>Similarity helps surface possible matches. It never decides ownership.</p></div><div className='rounded-2xl border border-white/10 bg-white/5 p-4'><div className='text-xs font-semibold'>Demo-only institution status</div><p className='mt-1 text-[11px] leading-5 text-white/65'>No university has approved a pilot. This preview uses fictional sample institutions and records.</p></div></div>
        </div>
      </section>
      <section className='mx-auto max-w-7xl px-4 py-10 sm:px-8'><DemoNotice /></section>
    </main>
    <footer className='border-t border-border'><div className='mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-[10px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8'><span>Vilivyopotea na Kupatikana · A concept built for safer returns</span><div className='flex gap-4'><Link href='/auth/sign-in' className='hover:text-foreground'>Account</Link><Link href='/dashboard/platform' className='hover:text-foreground'>Owner demo</Link></div></div></footer>
  </div>;
}
