import Image from 'next/image';
import Link from 'next/link';
import {
  IconArrowRight,
  IconEyeOff,
  IconLock,
  IconSearch,
  IconShieldCheck
} from '@tabler/icons-react';
import { BrandMark } from './app-shell';

const steps = [
  {
    number: '01',
    title: 'Share a safe summary',
    description:
      'Describe the category, approximate area and date. Keep the one-of-a-kind details to yourself.'
  },
  {
    number: '02',
    title: 'Review before sharing',
    description:
      'In a live service, a designated person would review a redacted summary before it became public.'
  },
  {
    number: '03',
    title: 'Verify, then return',
    description:
      'A possible match is only a lead. A responsible person would check a private claim and coordinate a handover.'
  }
];

const principles = [
  {
    icon: IconEyeOff,
    title: 'Keep the clues private',
    description:
      'Hold back unique marks, serial numbers and other details that only an owner should know.'
  },
  {
    icon: IconLock,
    title: 'Share less in public',
    description:
      'Use broad locations and never post phone numbers, student IDs or private contact details.'
  },
  {
    icon: IconShieldCheck,
    title: 'People make the call',
    description: 'Similarity can suggest a lead; it should never decide who owns an item.'
  }
];

export function LandingPage() {
  return (
    <div className='min-h-screen bg-background text-foreground'>
      <a
        href='#main-content'
        className='sr-only z-50 rounded-md bg-background px-4 py-2 text-sm focus:not-sr-only focus:fixed focus:left-4 focus:top-4'
      >
        Skip to content
      </a>

      <header className='sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl'>
        <div className='mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-5 px-5 sm:px-8'>
          <BrandMark />
          <nav
            className='hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex'
            aria-label='Main navigation'
          >
            <a className='transition-colors hover:text-foreground' href='#how-it-works'>
              How it works
            </a>
            <a className='transition-colors hover:text-foreground' href='#safety'>
              Safety by design
            </a>
            <Link className='transition-colors hover:text-foreground' href='/docs'>
              About the concept
            </Link>
          </nav>
          <Link
            href='/dashboard/search'
            className='inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:px-5'
          >
            Explore the demo <IconArrowRight aria-hidden size={16} />
          </Link>
        </div>
      </header>

      <main id='main-content'>
        <section className='relative isolate overflow-hidden'>
          <div aria-hidden className='pointer-events-none absolute inset-0 -z-10 overflow-hidden'>
            <div className='absolute -right-28 -top-28 size-[32rem] rounded-full bg-primary/10 blur-3xl' />
            <div className='absolute -left-40 top-72 size-[28rem] rounded-full bg-primary/5 blur-3xl' />
          </div>
          <div className='mx-auto grid max-w-7xl items-center gap-14 px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:grid-cols-[1fr_0.94fr] lg:gap-12 lg:pt-24'>
            <div className='relative z-10'>
              <div className='inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-foreground'>
                <span aria-hidden className='size-2 rounded-full bg-primary' />A pre-pilot concept
                for Tanzania
              </div>
              <h1 className='mt-7 max-w-[660px] text-[clamp(3.1rem,6.5vw,5.45rem)] font-semibold leading-[0.98] tracking-[-0.065em]'>
                Lost something?
                <br />
                <span className='text-primary'>Let’s find a safer way.</span>
              </h1>
              <p className='mt-7 max-w-xl text-base leading-8 text-muted-foreground sm:text-lg sm:leading-8'>
                Vilivyopotea na Kupatikana is a thoughtful lost-and-found concept for campus
                communities in Tanzania—built around safer listings, private claims and human-led
                returns.
              </p>
              <div className='mt-8 flex flex-col gap-3 sm:flex-row'>
                <Link
                  href='/dashboard/search'
                  className='group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/15 transition hover:-translate-y-0.5 hover:shadow-lg'
                >
                  <IconSearch aria-hidden size={17} />
                  Explore fictional listings
                  <IconArrowRight
                    aria-hidden
                    className='transition-transform group-hover:translate-x-0.5'
                    size={16}
                  />
                </Link>
                <a
                  href='#how-it-works'
                  className='inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background/80 px-6 py-3.5 text-sm font-semibold transition hover:border-primary/40 hover:bg-muted/60'
                >
                  See how it could work
                </a>
              </div>
              <p className='mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground'>
                <IconShieldCheck aria-hidden className='mt-0.5 shrink-0 text-primary' size={15} />
                This preview is not a live service. All records and institutions in the demo are
                fictional.
              </p>
            </div>

            <div className='relative mx-auto w-full max-w-[570px] lg:ml-auto'>
              <div
                aria-hidden
                className='absolute -inset-5 rounded-[3rem] bg-primary/10 blur-2xl'
              />
              <div className='relative rounded-[2rem] border border-border/80 bg-card/85 p-3 shadow-2xl shadow-foreground/10 backdrop-blur sm:rounded-[2.4rem] sm:p-4'>
                <div className='flex items-center justify-between gap-3 px-2 pb-3 pt-1 sm:px-3'>
                  <div className='flex items-center gap-2.5'>
                    <span
                      aria-hidden
                      className='flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary'
                    >
                      <IconSearch size={15} />
                    </span>
                    <div>
                      <p className='text-xs font-semibold'>A safer way to look</p>
                      <p className='mt-0.5 text-[10px] text-muted-foreground'>Concept preview</p>
                    </div>
                  </div>
                  <span className='rounded-full border border-border bg-muted/50 px-3 py-1.5 text-[10px] font-semibold text-muted-foreground'>
                    Fictional example
                  </span>
                </div>

                <div className='relative aspect-[1.35] overflow-hidden rounded-[1.5rem] bg-muted sm:aspect-[1.45] sm:rounded-[1.8rem]'>
                  <Image
                    src='/images/community-items-hero.webp'
                    alt='A dark green backpack, notebook and keys on a wooden bench in a sunlit courtyard'
                    fill
                    priority
                    sizes='(max-width: 1024px) 90vw, 45vw'
                    className='object-cover'
                  />
                  <div className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent px-5 pb-4 pt-14 sm:px-6 sm:pb-5'>
                    <span className='inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/25 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm'>
                      Illustrative image · Not a real listing
                    </span>
                  </div>
                </div>

                <div className='px-2 pb-2 pt-4 sm:px-3 sm:pb-3 sm:pt-5'>
                  <div className='flex flex-wrap items-start justify-between gap-3'>
                    <div>
                      <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-primary'>
                        A found item · sample
                      </p>
                      <h2 className='mt-1.5 text-lg font-semibold tracking-tight sm:text-xl'>
                        Everyday essentials
                      </h2>
                    </div>
                    <span className='rounded-full bg-muted px-3 py-1.5 text-[10px] font-medium text-muted-foreground'>
                      Preview record
                    </span>
                  </div>
                  <div className='mt-4 flex items-start gap-2.5 border-t border-border pt-3.5 text-xs leading-5 text-muted-foreground'>
                    <IconEyeOff aria-hidden className='mt-0.5 shrink-0 text-primary' size={15} />
                    <p>
                      In a real service, unique identifying details would stay private during a
                      claim.
                    </p>
                  </div>
                </div>
              </div>
              <div className='absolute -bottom-5 right-4 flex items-center gap-2.5 rounded-2xl border border-border bg-background px-3.5 py-3 shadow-lg sm:-right-5 sm:bottom-8 sm:px-4'>
                <span
                  aria-hidden
                  className='flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary'
                >
                  <IconLock size={17} />
                </span>
                <span>
                  <span className='block text-xs font-semibold'>Privacy, first</span>
                  <span className='mt-0.5 block text-[10px] text-muted-foreground'>
                    A design principle
                  </span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          aria-label='Design principles'
          className='mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-24'
        >
          <div className='rounded-[1.75rem] border border-border bg-card/70 p-5 sm:p-7'>
            <div className='mb-5 flex flex-wrap items-end justify-between gap-3'>
              <div>
                <p className='text-[10px] font-bold uppercase tracking-[0.18em] text-primary'>
                  The idea, at a glance
                </p>
                <h2 className='mt-1.5 text-lg font-semibold tracking-tight'>
                  A little less guesswork. A lot more care.
                </h2>
              </div>
              <p className='text-xs text-muted-foreground'>
                Principles for a future service—not live guarantees.
              </p>
            </div>
            <div className='grid gap-3 sm:grid-cols-3'>
              {principles.map(({ icon: Icon, title, description }) => (
                <div key={title} className='flex gap-3 rounded-2xl bg-muted/50 p-4'>
                  <span
                    aria-hidden
                    className='flex size-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary shadow-sm'
                  >
                    <Icon size={17} />
                  </span>
                  <div>
                    <h3 className='text-sm font-semibold'>{title}</h3>
                    <p className='mt-1.5 text-xs leading-5 text-muted-foreground'>{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id='how-it-works' className='scroll-mt-28 border-y border-border/70 bg-muted/25'>
          <div className='mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24'>
            <div className='mx-auto max-w-2xl text-center'>
              <p className='text-[10px] font-bold uppercase tracking-[0.18em] text-primary'>
                A considered process
              </p>
              <h2 className='mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl'>
                A careful path from report to return.
              </h2>
              <p className='mt-4 text-sm leading-7 text-muted-foreground sm:text-base'>
                The concept puts privacy and a human check at each step—so a listing can help
                without giving everything away.
              </p>
            </div>
            <div className='mt-10 grid gap-4 md:grid-cols-3 md:gap-5'>
              {steps.map((step) => (
                <article
                  key={step.number}
                  className='group rounded-[1.5rem] border border-border bg-card p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg sm:p-7'
                >
                  <div className='flex items-center justify-between'>
                    <span className='flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary'>
                      {step.number}
                    </span>
                    <span
                      aria-hidden
                      className='h-px w-12 bg-border transition-colors group-hover:bg-primary/50'
                    />
                  </div>
                  <h3 className='mt-7 text-lg font-semibold tracking-tight'>{step.title}</h3>
                  <p className='mt-3 text-sm leading-6 text-muted-foreground'>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id='safety' className='scroll-mt-28 mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24'>
          <div className='grid overflow-hidden rounded-[2rem] border border-border bg-card lg:grid-cols-[0.9fr_1.1fr]'>
            <div className='relative overflow-hidden bg-primary/10 p-7 sm:p-10 lg:p-12'>
              <div
                aria-hidden
                className='absolute -bottom-20 -right-16 size-72 rounded-full border-[36px] border-primary/10'
              />
              <div className='relative'>
                <span className='inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary'>
                  <IconShieldCheck aria-hidden size={14} /> Safety by design
                </span>
                <h2 className='mt-5 max-w-md text-3xl font-semibold leading-tight tracking-[-0.045em] sm:text-4xl'>
                  The right details help. The wrong ones put people at risk.
                </h2>
                <p className='mt-4 max-w-md text-sm leading-7 text-muted-foreground'>
                  A public note should help someone recognise the general item—not let a stranger
                  prove they own it.
                </p>
                <Link
                  href='/docs'
                  className='mt-6 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition hover:text-primary'
                >
                  Read the project notes <IconArrowRight aria-hidden size={16} />
                </Link>
              </div>
            </div>
            <div className='grid gap-0 divide-y divide-border p-6 sm:p-9 lg:p-10'>
              <div className='flex gap-4 py-4 first:pt-0'>
                <IconEyeOff aria-hidden className='mt-0.5 shrink-0 text-primary' size={19} />
                <div>
                  <h3 className='text-sm font-semibold'>Keep one clue back</h3>
                  <p className='mt-1.5 text-sm leading-6 text-muted-foreground'>
                    Unique marks, exact contents and serial numbers should not appear in a public
                    description.
                  </p>
                </div>
              </div>
              <div className='flex gap-4 py-4'>
                <IconLock aria-hidden className='mt-0.5 shrink-0 text-primary' size={19} />
                <div>
                  <h3 className='text-sm font-semibold'>Protect personal details</h3>
                  <p className='mt-1.5 text-sm leading-6 text-muted-foreground'>
                    Phone numbers, student IDs and private evidence belong in a protected
                    conversation, not on a public listing.
                  </p>
                </div>
              </div>
              <div className='flex gap-4 py-4 last:pb-0'>
                <IconShieldCheck aria-hidden className='mt-0.5 shrink-0 text-primary' size={19} />
                <div>
                  <h3 className='text-sm font-semibold'>A match is not proof</h3>
                  <p className='mt-1.5 text-sm leading-6 text-muted-foreground'>
                    If matching suggestions are used, people—not a score or an algorithm—must verify
                    ownership and decide what happens next.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className='mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-24'>
          <div className='flex flex-col items-start justify-between gap-6 rounded-[1.75rem] border border-border bg-muted/35 p-6 sm:flex-row sm:items-center sm:p-8'>
            <div className='max-w-2xl'>
              <p className='text-[10px] font-bold uppercase tracking-[0.18em] text-primary'>
                Take a closer look
              </p>
              <h2 className='mt-2 text-2xl font-semibold tracking-tight'>
                See the concept in motion.
              </h2>
              <p className='mt-2 text-sm leading-6 text-muted-foreground'>
                Browse fictional listings and preview the reporting experience. No real reports are
                being collected here.
              </p>
            </div>
            <Link
              href='/dashboard/search'
              className='inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5'
            >
              Open the demo <IconArrowRight aria-hidden size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer className='border-t border-border'>
        <div className='mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5'>
            <BrandMark />
            <p className='max-w-xl text-xs leading-5 text-muted-foreground'>
              Pre-pilot concept only. The demo uses fictional records; no university is represented
              as a partner. This is not a live service.
            </p>
          </div>
          <div className='flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-foreground'>
            <Link className='transition hover:text-foreground' href='/dashboard/search'>
              Demo search
            </Link>
            <Link className='transition hover:text-foreground' href='/dashboard/report'>
              Demo report
            </Link>
            <Link className='transition hover:text-foreground' href='/docs'>
              Project notes
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
