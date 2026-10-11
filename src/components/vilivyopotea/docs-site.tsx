'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { documentationNavigation, documentationPages } from '@/lib/docs-content';

export function DocumentationShell({ children }: { children: ReactNode }) {
  return (
    <div className='min-h-svh bg-background text-foreground'>
      <header className='sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur'>
        <div className='mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-8'>
          <Link href='/docs' className='flex items-center gap-3' aria-label='Developer docs home'>
            <span className='flex size-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground'>
              V
            </span>
            <span>
              <span className='block text-sm font-semibold tracking-tight'>Developer docs</span>
              <span className='block text-[10px] text-muted-foreground'>
                Vilivyopotea na Kupatikana
              </span>
            </span>
          </Link>
          <nav className='flex items-center gap-2 text-xs font-medium' aria-label='Site navigation'>
            <Link
              href='/'
              className='rounded-lg px-3 py-2 text-muted-foreground hover:bg-muted hover:text-foreground'
            >
              Public site
            </Link>
            <Link
              href='/dashboard/overview'
              className='rounded-lg bg-primary px-3 py-2 text-primary-foreground hover:opacity-90'
            >
              Open app
            </Link>
          </nav>
        </div>
      </header>
      <div className='mx-auto grid max-w-screen-2xl gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-12'>
        <aside className='lg:sticky lg:top-24 lg:max-h-[calc(100svh-7rem)] lg:self-start lg:overflow-y-auto'>
          <p className='mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground'>
            Documentation
          </p>
          <nav
            className='grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-1'
            aria-label='Documentation topics'
          >
            {documentationNavigation.map((item) => (
              <Link
                key={item.slug}
                href={`/docs/${item.slug}`}
                className='rounded-lg px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className='mt-6 rounded-xl border border-border bg-card p-4'>
            <p className='text-xs font-semibold'>Demo boundary</p>
            <p className='mt-2 text-[10px] leading-5 text-muted-foreground'>
              Fictional data only. No institution has approved a pilot. AI suggestions never decide
              ownership.
            </p>
          </div>
        </aside>
        <main className='min-w-0'>{children}</main>
      </div>
      <footer className='border-t border-border px-4 py-5 text-center text-[10px] text-muted-foreground sm:px-8'>
        Technical reference for the pre-pilot foundation · Public-safe examples only
      </footer>
    </div>
  );
}

export function DocumentationIndex() {
  return (
    <div className='space-y-8'>
      <section className='rounded-3xl border border-border bg-card p-6 sm:p-10'>
        <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-primary'>
          Developer portal · Next.js
        </p>
        <h1 className='mt-3 max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl'>
          Build on a safer lost-and-found foundation.
        </h1>
        <p className='mt-4 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base'>
          Explore the Next.js experiences, Go API, Python matching service, FastMCP adapter, and the
          boundaries that keep private claims and evidence private.
        </p>
        <div className='mt-6 flex flex-wrap gap-3'>
          <Link
            href='/docs/architecture'
            className='rounded-xl bg-primary px-4 py-3 text-xs font-semibold text-primary-foreground hover:opacity-90'
          >
            Explore architecture
          </Link>
          <Link
            href='/docs/api'
            className='rounded-xl border border-border px-4 py-3 text-xs font-semibold hover:bg-muted'
          >
            API reference
          </Link>
        </div>
      </section>
      <section>
        <div className='mb-4'>
          <p className='text-[10px] font-bold uppercase tracking-[0.15em] text-primary'>
            Reference library
          </p>
          <h2 className='mt-2 text-xl font-bold tracking-tight'>Choose a topic</h2>
        </div>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-3'>
          {documentationNavigation.map((item) => {
            const page = documentationPages[item.slug];
            return (
              <Link
                key={item.slug}
                href={`/docs/${item.slug}`}
                className='group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-secondary/40'
              >
                <p className='text-[10px] font-bold uppercase tracking-[0.13em] text-primary'>
                  {page.eyebrow}
                </p>
                <h3 className='mt-2 text-sm font-bold group-hover:text-primary'>{page.title}</h3>
                <p className='mt-2 text-xs leading-6 text-muted-foreground'>{page.summary}</p>
                <span className='mt-4 inline-block text-xs font-semibold text-primary'>
                  Read docs <span aria-hidden='true'>→</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
      <section className='rounded-2xl border border-amber-300/60 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/30'>
        <p className='text-xs font-bold text-amber-950 dark:text-amber-100'>
          Important: embeddings are not active today
        </p>
        <p className='mt-2 text-xs leading-6 text-amber-900 dark:text-amber-100/80'>
          The Python service currently ranks suggestions with deterministic lexical, category, date,
          and location signals. EmbeddingGemma is a possible future evaluation only; no model or
          vector store is connected.
        </p>
      </section>
    </div>
  );
}

export function DocumentationArticle({ slug }: { slug: string }) {
  const page = documentationPages[slug];
  if (!page) return null;
  return (
    <article className='mx-auto max-w-4xl'>
      <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-primary'>
        {page.eyebrow}
      </p>
      <h1 className='mt-3 text-3xl font-bold tracking-tight sm:text-4xl'>{page.title}</h1>
      <p className='mt-4 max-w-3xl text-sm leading-7 text-muted-foreground'>{page.summary}</p>
      <div className='mt-8 space-y-8'>
        {page.sections.map((section) => (
          <section key={section.title} className='border-t border-border pt-6'>
            <h2 className='text-lg font-bold tracking-tight'>{section.title}</h2>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph} className='mt-3 text-sm leading-7 text-muted-foreground'>
                {paragraph}
              </p>
            ))}
            {section.bullets && (
              <ul className='mt-4 space-y-2.5'>
                {section.bullets.map((bullet) => (
                  <li key={bullet} className='flex gap-3 text-sm leading-6 text-muted-foreground'>
                    <span className='mt-2 size-1.5 shrink-0 rounded-full bg-primary' />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            )}
            {section.code && (
              <pre className='mt-4 overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 text-xs leading-6 text-foreground'>
                <code>{section.code}</code>
              </pre>
            )}
            {section.links && (
              <div className='mt-4 flex flex-wrap gap-2'>
                {section.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target='_blank'
                    rel='noreferrer'
                    className='rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary'
                  >
                    {link.label} ↗
                  </a>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
      <div className='mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs'>
        <Link href='/docs' className='font-semibold text-primary'>
          ← All documentation
        </Link>
        <Link href='/dashboard/overview' className='text-muted-foreground hover:text-foreground'>
          Open the demo app
        </Link>
      </div>
    </article>
  );
}
