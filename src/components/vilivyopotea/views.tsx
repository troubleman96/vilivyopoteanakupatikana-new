'use client';

import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { isApiConfigured } from '@/lib/api';
import { demoActivity, demoCases, demoInstitutions, demoItems } from '@/lib/demo-data';
import {
  ActionLink,
  Artwork,
  DemoNotice,
  ItemCard,
  PageHeading,
  StatCard,
  StatusPill
} from './primitives';
import { useDemoRole } from './role-context';
import { StaffCaseQueue } from './staff-case-queue';
import {
  IconArrowRight,
  IconCheck,
  IconFilter,
  IconSearch,
  IconSparkles,
  IconUsers
} from '@tabler/icons-react';

const cardClass = 'rounded-2xl border border-border bg-card';

function SectionCard({
  title,
  subtitle,
  children,
  action
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`${cardClass} p-4 sm:p-5`}>
      <div className='mb-4 flex items-start justify-between gap-3'>
        <div>
          <h2 className='text-sm font-bold'>{title}</h2>
          {subtitle && <p className='mt-1 text-[10px] text-muted-foreground'>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActivityRows() {
  return (
    <div className='divide-y divide-border'>
      {demoActivity.map((item) => (
        <div key={item.title} className='flex items-start gap-3 py-3 first:pt-0 last:pb-0'>
          <span
            className={`mt-1.5 size-2 rounded-full ${item.kind === 'claim' ? 'bg-amber-500' : item.kind === 'match' ? 'bg-blue-500' : 'bg-primary'}`}
          />
          <div className='min-w-0 flex-1'>
            <p className='text-xs font-semibold'>{item.title}</p>
            <p className='mt-1 truncate text-[10px] text-muted-foreground'>{item.detail}</p>
          </div>
          <span className='shrink-0 text-[10px] text-muted-foreground'>{item.time}</span>
        </div>
      ))}
    </div>
  );
}

export function OverviewView() {
  const { role } = useDemoRole();
  if (role === 'individual') return <IndividualOverview />;
  if (role === 'institution') return <InstitutionOverview compact />;
  if (role === 'platform') return <PlatformOverview compact />;
  return <StaffOverview />;
}

function IndividualOverview() {
  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='PERSONAL ACCOUNT · DEMO'
        title='Good morning, Amina.'
        description='Here is what is happening with your reports and claims.'
        action={<ActionLink href='/dashboard/report'>Report an item</ActionLink>}
      />
      <DemoNotice />
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='My reports' value='3' note='All fictional demo records' />
        <StatCard label='Active claims' value='1' note='Private to your account' accent='blue' />
        <StatCard label='Possible matches' value='2' note='Suggestions, not proof' accent='amber' />
        <StatCard label='Returned items' value='1' note='Staff-confirmed in this demo' />
      </div>
      <div className='grid gap-4 lg:grid-cols-[1.2fr_0.8fr]'>
        <SectionCard title='Recent activity' subtitle='Synthetic account timeline'>
          <ActivityRows />
        </SectionCard>
        <SectionCard title='Your next step' subtitle='Private claim update'>
          <div className='rounded-xl bg-amber-50 p-4 dark:bg-amber-950/40'>
            <StatusPill tone='amber'>ACTION NEEDED</StatusPill>
            <h3 className='mt-3 text-sm font-bold'>Add requested evidence</h3>
            <p className='mt-2 text-xs leading-5 text-muted-foreground'>
              A staff reviewer requested one private detail for claim CL-0219. Please do not add it
              to a public listing.
            </p>
            <Link
              href='/dashboard/account'
              className='mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary'
            >
              Open claim <IconArrowRight size={14} />
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function StaffOverview() {
  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='UNIVERSITY WORKSPACE · DEMO'
        title='Case queue'
        description='Triage this institution’s reports and claims. Only assigned demo reviewers can see this fictional workspace.'
        action={<ActionLink href='/dashboard/cases'>Open case queue</ActionLink>}
      />
      <DemoNotice />
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='Open cases' value='28' note='Tenant-scoped demo workload' />
        <StatCard label='Reports to review' value='6' note='Oldest: 2 hours' accent='amber' />
        <StatCard
          label='Claims awaiting evidence'
          value='9'
          note='Private review required'
          accent='blue'
        />
        <StatCard label='Handovers today' value='3' note='Staff-coordinated' />
      </div>
      <div className='grid gap-4 lg:grid-cols-[1.35fr_0.65fr]'>
        <SectionCard
          title='Priority work'
          subtitle='Oldest open work first'
          action={
            <Link href='/dashboard/cases' className='text-[11px] font-semibold text-primary'>
              View queue →
            </Link>
          }
        >
          <CaseRows compact />
        </SectionCard>
        <SectionCard title='Matching is assistive' subtitle='Human verification required'>
          <div className='rounded-xl bg-secondary p-4'>
            <div className='flex items-center gap-2 text-xs font-bold'>
              <IconSparkles size={15} /> Possible match suggestion
            </div>
            <p className='mt-2 text-[11px] leading-5 text-muted-foreground'>
              Two records share a general category and date window. This is a lead only; it cannot
              verify ownership or decide a claim.
            </p>
            <StatusPill tone='blue'>AI suggestion · unverified</StatusPill>
          </div>
          <div className='mt-4'>
            <DemoNotice>
              Keep hidden identifying details private. Record verification reasons and handover
              outcomes in the institution workspace.
            </DemoNotice>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export function SearchView() {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'All' | 'Found' | 'Missing'>('All');
  const [category, setCategory] = useState('All categories');
  const [selected, setSelected] = useState<string | null>(null);
  const [claimSent, setClaimSent] = useState(false);
  const categories = [
    'All categories',
    ...Array.from(new Set(demoItems.map((item) => item.category)))
  ];
  const filtered = useMemo(
    () =>
      demoItems.filter((item) => {
        const text =
          `${item.title} ${item.category} ${item.place} ${item.description}`.toLowerCase();
        return (
          text.includes(query.toLowerCase()) &&
          (kind === 'All' || item.kind === kind) &&
          (category === 'All categories' || item.category === category)
        );
      }),
    [query, kind, category]
  );
  const activeItem = demoItems.find((item) => item.id === selected);
  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='PUBLIC DISCOVERY · REVIEWED LISTINGS ONLY'
        title='Search lost and found'
        description='Browse safe public summaries. A possible match is only a starting point—staff verify all claims.'
        action={<ActionLink href='/dashboard/report'>Report an item</ActionLink>}
      />
      <div className={`${cardClass} p-4 sm:p-5`}>
        <label htmlFor='item-search' className='mb-2 block text-xs font-semibold'>
          Search a general description
        </label>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <div className='relative flex-1'>
            <IconSearch className='absolute left-3 top-3 size-4 text-muted-foreground' />
            <input
              id='item-search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='e.g. blue bottle, black laptop sleeve'
              className='h-10 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring'
            />
          </div>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className='h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring'
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <button
            className='inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground'
            onClick={() => setKind('All')}
          >
            <IconFilter size={15} /> Search
          </button>
        </div>
        <div className='mt-4 flex gap-2'>
          {(['All', 'Found', 'Missing'] as const).map((choice) => (
            <button
              key={choice}
              onClick={() => setKind(choice)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${kind === choice ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {choice}
            </button>
          ))}
          <span className='ml-auto self-center text-[10px] text-muted-foreground'>
            {filtered.length} reviewed demo listings
          </span>
        </div>
      </div>
      {activeItem && (
        <div className='grid gap-4 rounded-2xl border border-primary/20 bg-card p-4 sm:grid-cols-[180px_1fr] sm:p-5'>
          <Artwork item={activeItem} className='min-h-[140px]' />
          <div>
            <div className='flex justify-between gap-3'>
              <div>
                <StatusPill tone='green'>Found · reviewed</StatusPill>
                <h2 className='mt-2 text-base font-bold'>{activeItem.title}</h2>
              </div>
              <button
                onClick={() => {
                  setSelected(null);
                  setClaimSent(false);
                }}
                className='text-xs text-muted-foreground hover:text-foreground'
                aria-label='Close listing details'
              >
                Close
              </button>
            </div>
            <p className='mt-2 text-xs leading-5 text-muted-foreground'>{activeItem.description}</p>
            <p className='mt-2 text-[10px] text-muted-foreground'>
              {activeItem.place} · {activeItem.date} · {activeItem.id}
            </p>
            <div className='mt-4 rounded-lg bg-amber-50 p-3 text-[10px] leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'>
              Safe public summary · some identifying details are intentionally withheld.
            </div>
            {claimSent ? (
              <p className='mt-3 text-xs font-semibold text-primary'>
                Demo claim saved privately for staff review. No one has been contacted.
              </p>
            ) : (
              <button
                onClick={() => setClaimSent(true)}
                className='mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground'
              >
                I think this is mine
              </button>
            )}
          </div>
        </div>
      )}
      {filtered.length ? (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {filtered.map((item) => (
            <div key={item.id} className='relative'>
              <ItemCard item={item} />
              <button
                onClick={() => {
                  setSelected(item.id);
                  setClaimSent(false);
                }}
                className='absolute bottom-4 right-4 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-semibold text-primary hover:bg-secondary'
              >
                Safe details
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${cardClass} px-6 py-12 text-center`}>
          <h2 className='text-sm font-bold'>No matching listings</h2>
          <p className='mt-1 text-xs text-muted-foreground'>
            Try a wider description or clear a filter. Only synthetic examples are included.
          </p>
        </div>
      )}
      <DemoNotice>
        Only reviewed, public-safe summaries are shown here. Personal contact details, claims and
        verification evidence are never public.
      </DemoNotice>
    </div>
  );
}

export function ReportView() {
  const [kind, setKind] = useState<'Found' | 'Missing'>('Found');
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState('');
  const [step, setStep] = useState(1);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReference(`VF-${String(Math.floor(1000 + Math.random() * 8999))}`);
    setSubmitted(true);
  }
  if (submitted)
    return (
      <div className='mx-auto max-w-2xl space-y-5 py-10 text-center'>
        <div className='mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-primary'>
          <IconCheck size={26} />
        </div>
        <PageHeading
          eyebrow='DEMO CONFIRMATION'
          title='Report saved for review'
          description='This sample was kept in this browser preview only. No real record was sent.'
        />
        <div className='mx-auto max-w-sm rounded-2xl border border-border bg-card p-5'>
          <p className='text-[10px] uppercase tracking-widest text-muted-foreground'>Reference</p>
          <p className='mt-1 text-xl font-bold'>{reference}</p>
          <StatusPill tone='amber'>Pending staff review</StatusPill>
        </div>
        <div className='mx-auto max-w-md text-left'>
          <DemoNotice>
            Found-item reports are not public until staff review the public-safe summary. Keep
            identifying clues private.
          </DemoNotice>
        </div>
        <div className='flex justify-center gap-3'>
          <ActionLink href='/dashboard/search' variant='secondary'>
            Back to search
          </ActionLink>
          <button
            onClick={() => {
              setSubmitted(false);
              setStep(1);
            }}
            className='rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground'
          >
            Submit another
          </button>
        </div>
      </div>
    );
  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='PUBLIC REPORTING · DEMO ONLY'
        title={`Report a ${kind.toLowerCase()} item`}
        description='Share enough for staff to review, but keep distinctive proof private.'
      />
      <div className='grid gap-5 lg:grid-cols-[1fr_300px]'>
        <form onSubmit={submit} className={`${cardClass} space-y-4 p-4 sm:p-6`}>
          <div className='flex items-center gap-2'>
            {[1, 2, 3].map((number) => (
              <div key={number} className='flex items-center gap-2'>
                <span
                  className={`flex size-7 items-center justify-center rounded-full text-[10px] font-bold ${step >= number ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                >
                  {number}
                </span>
                {number < 3 && <span className='h-px w-7 bg-border' />}
              </div>
            ))}
            <span className='ml-2 text-[10px] font-semibold text-muted-foreground'>
              Step {step} of 3
            </span>
          </div>
          {step === 1 && (
            <>
              <fieldset>
                <legend className='mb-2 text-xs font-semibold'>What are you reporting?</legend>
                <div className='grid grid-cols-2 gap-2'>
                  {(['Found', 'Missing'] as const).map((choice) => (
                    <button
                      type='button'
                      key={choice}
                      onClick={() => setKind(choice)}
                      className={`rounded-xl border px-4 py-3 text-left text-xs font-semibold ${kind === choice ? 'border-primary bg-secondary text-secondary-foreground' : 'border-border hover:bg-muted'}`}
                    >
                      {choice} item
                    </button>
                  ))}
                </div>
              </fieldset>
              <Field label='Institution or search area'>
                <select className='form-control' defaultValue=''>
                  <option value=''>Choose a demo institution or area</option>
                  <option>Example University (Demo)</option>
                  <option>Coastal Campus (Demo)</option>
                  <option>Highland Institute (Demo)</option>
                  <option>Not sure / general area</option>
                </select>
              </Field>
              <div className='grid gap-4 sm:grid-cols-2'>
                <Field label='Category'>
                  <select className='form-control' required>
                    <option value=''>Choose a category</option>
                    <option>Electronics</option>
                    <option>Personal accessories</option>
                    <option>Keys & cards</option>
                    <option>Bags</option>
                    <option>Books & stationery</option>
                    <option>Other</option>
                  </select>
                </Field>
                <Field
                  label={kind === 'Found' ? 'Approximate date found' : 'Approximate date last seen'}
                >
                  <input type='date' className='form-control' />
                </Field>
              </div>
              <Field label='Approximate area'>
                <input className='form-control' placeholder='e.g. library area, lecture hall' />
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <Field label='Short public description'>
                <textarea
                  required
                  rows={5}
                  className='form-control resize-y'
                  placeholder='Describe the item in general terms. Keep one or more unique clues private.'
                  minLength={8}
                />
              </Field>
              <div className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'>
                Do not include phone numbers, student IDs, serial numbers, addresses or unique
                identifying marks in public text.
              </div>
              <Field label='Optional photo'>
                <input
                  type='file'
                  accept='image/png,image/jpeg,image/webp'
                  className='form-control file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-[10px] file:font-semibold'
                />
                <span className='mt-1 block text-[10px] text-muted-foreground'>
                  Demo preview does not upload this file. A live service would need moderation
                  before publication.
                </span>
              </Field>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className='text-sm font-bold'>Review before sending</h2>
              <div className='rounded-xl bg-muted/60 p-4 text-xs leading-6 text-muted-foreground'>
                Your report will be marked{' '}
                <strong className='text-foreground'>pending staff review</strong>. Any public
                version should contain only a redacted safe summary. Private follow-up details
                remain private.
              </div>
              <label className='flex gap-2 text-xs leading-5'>
                <input type='checkbox' required className='mt-1 accent-primary' />I understand that
                reports are demo-only here and that a real service would require staff review before
                publication.
              </label>
            </>
          )}
          <div className='flex flex-wrap gap-2 border-t border-border pt-4'>
            {step > 1 && (
              <button
                type='button'
                onClick={() => setStep(step - 1)}
                className='rounded-xl border border-border px-4 py-2.5 text-xs font-semibold'
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type='button'
                onClick={() => setStep(step + 1)}
                className='rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground'
              >
                Continue
              </button>
            ) : (
              <button
                type='submit'
                className='rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground'
              >
                Save demo report
              </button>
            )}
            <span className='self-center text-[10px] text-muted-foreground'>
              Free to report · private claims · people verify
            </span>
          </div>
        </form>
        <div className='space-y-4'>
          <SectionCard title='Before you continue' subtitle='Public listing safety'>
            <ul className='space-y-3 text-[11px] leading-5 text-muted-foreground'>
              <li>✓ Share only a general description and approximate area.</li>
              <li>✓ Keep serials, exact locations and identifying marks private.</li>
              <li>✓ Found-item details need staff review before publication.</li>
              <li>✓ Claims and evidence are handled privately by staff.</li>
            </ul>
          </SectionCard>
          <DemoNotice>
            This is a synthetic, local-only workflow. No report leaves your browser.
          </DemoNotice>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className='block text-xs font-semibold'>
      {label}
      <div className='mt-2'>{children}</div>
    </label>
  );
}

function CaseRows({
  compact = false,
  entries = demoCases
}: {
  compact?: boolean;
  entries?: typeof demoCases;
}) {
  return (
    <div className='divide-y divide-border'>
      {entries.map((item) => (
        <div key={item.id} className='flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0'>
          <span className='w-14 shrink-0 font-mono text-[10px] font-semibold text-primary'>
            {item.id}
          </span>
          <div className='min-w-[140px] flex-1'>
            <p className='text-xs font-semibold'>{item.subject}</p>
            {!compact && (
              <p className='mt-1 text-[10px] text-muted-foreground'>
                {item.type} · {item.age}
              </p>
            )}
          </div>
          <StatusPill
            tone={
              item.state === 'Needs review'
                ? 'amber'
                : item.state === 'Scheduled'
                  ? 'blue'
                  : 'neutral'
            }
          >
            {item.state}
          </StatusPill>
          {!compact && (
            <Link
              href={item.type === 'Claim' ? '/dashboard/claims' : '/dashboard/cases'}
              className='text-[10px] font-semibold text-primary'
            >
              Open →
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

export function CaseQueueView() {
  return isApiConfigured() ? <StaffCaseQueue /> : <DemoCaseQueueView />;
}

function DemoCaseQueueView() {
  const [filter, setFilter] = useState('All open');
  const [cases, setCases] = useState(demoCases);
  const visible = filter === 'All open' ? cases : cases.filter((item) => item.type === filter);
  function markReviewed(id: string) {
    setCases((items) =>
      items.map((item) => (item.id === id ? { ...item, state: 'Review in progress' } : item))
    );
  }
  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='STAFF CASEWORK · DEMO TENANT'
        title='Case queue'
        description='Review found-item summaries, private claims and return coordination in one institution-scoped workspace.'
        action={<ActionLink href='/dashboard/report'>New demo case</ActionLink>}
      />
      <DemoNotice />
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='Open cases' value='28' note='Synthetic tenant workload' />
        <StatCard label='Reports to review' value='6' note='Oldest: 2 hours' accent='amber' />
        <StatCard
          label='Claims awaiting evidence'
          value='9'
          note='Private responses'
          accent='blue'
        />
        <StatCard label='Handovers today' value='3' note='Staff coordinated' />
      </div>
      <SectionCard
        title='Assigned institution work'
        subtitle='Example University (Demo) · sorted by age and risk'
      >
        <div className='mb-4 flex flex-wrap gap-2'>
          {['All open', 'Found report', 'Claim', 'Handover'].map((choice) => (
            <button
              key={choice}
              onClick={() => setFilter(choice)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${filter === choice ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
            >
              {choice}
            </button>
          ))}
          <span className='ml-auto self-center text-[10px] text-muted-foreground'>
            No cross-institution records
          </span>
        </div>
        <CaseRows entries={visible} />
        <div className='mt-5 border-t border-border pt-4'>
          <div className='grid gap-3 sm:grid-cols-2'>
            {cases
              .filter((item) => item.state === 'Needs review' || item.state === 'Open')
              .slice(0, 2)
              .map((item) => (
                <div key={item.id} className='rounded-xl border border-border p-3'>
                  <p className='text-xs font-semibold'>{item.subject}</p>
                  <p className='mt-1 text-[10px] text-muted-foreground'>
                    Priority: {item.priority} · {item.age}
                  </p>
                  <div className='mt-3 flex gap-2'>
                    <button
                      onClick={() => markReviewed(item.id)}
                      className='rounded-lg bg-primary px-3 py-2 text-[10px] font-semibold text-primary-foreground'
                    >
                      Start review
                    </button>
                    <Link
                      href={item.type === 'Claim' ? '/dashboard/claims' : '/dashboard/cases'}
                      className='rounded-lg border border-border px-3 py-2 text-[10px] font-semibold'
                    >
                      Open details
                    </Link>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </SectionCard>
      <div className='grid gap-4 md:grid-cols-2'>
        <SectionCard title='Verification boundary'>
          <p className='text-xs leading-6 text-muted-foreground'>
            Staff verify claims using private evidence that is not visible in the public listing. AI
            match ranking can only suggest records for human review.
          </p>
        </SectionCard>
        <SectionCard title='Tenant isolation'>
          <p className='text-xs leading-6 text-muted-foreground'>
            This preview uses a single synthetic workspace. Real authorization must be enforced by
            the API and database, never by navigation visibility alone.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}

export function ClaimReviewView() {
  const [decision, setDecision] = useState('');
  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='PRIVATE STAFF REVIEW · SYNTHETIC CLAIM'
        title='Claim review · CL-0219'
        description='Compare the claimant’s private response with withheld item details. This screen never exposes evidence publicly.'
        action={<StatusPill tone='amber'>Pending human review</StatusPill>}
      />
      <DemoNotice />
      <div className='grid gap-4 lg:grid-cols-2'>
        <SectionCard
          title='Claimant details'
          subtitle='Fictional contact; private to the assigned team'
        >
          <StatusPill tone='neutral'>Private</StatusPill>
          <p className='mt-3 text-xs leading-6 text-muted-foreground'>
            Account: Amina J. (demo)
            <br />
            Submitted: 10 Oct 2026
            <br />
            Claimed item: Blue water bottle · VF-0316
          </p>
          <div className='mt-4 rounded-xl bg-blue-50 p-3 text-[11px] leading-5 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100'>
            Private response received: “There is a small engraved mark near the base.” The exact
            detail is not included in public listing text.
          </div>
          <div className='mt-4 rounded-xl border border-border p-3'>
            <p className='text-xs font-semibold'>AI match suggestion</p>
            <p className='mt-1 text-[11px] leading-5 text-muted-foreground'>
              General category and date overlap. Suggestion is not proof and is not part of the
              ownership decision.
            </p>
            <StatusPill tone='blue'>Possible match · unverified</StatusPill>
          </div>
        </SectionCard>
        <SectionCard
          title='Human verification checklist'
          subtitle='Record an outcome only after reviewing the private evidence'
        >
          <div className='space-y-3'>
            {[
              'Private detail matches item record',
              'Evidence is relevant and proportionate',
              'No unnecessary sensitive data retained'
            ].map((text) => (
              <label key={text} className='flex items-start gap-2.5 text-xs'>
                <input type='checkbox' className='mt-0.5 accent-primary' />
                <span>{text}</span>
              </label>
            ))}
          </div>
          <label className='mt-5 block text-xs font-semibold'>
            Reviewer note
            <textarea
              rows={3}
              className='form-control mt-2 resize-y'
              placeholder='Record a concise reason category. Do not copy full evidence.'
            />
          </label>
          <label className='mt-4 block text-xs font-semibold'>
            Decision reason category
            <select className='form-control mt-2'>
              <option>Choose a reason</option>
              <option>Private detail verified in person</option>
              <option>More evidence required</option>
              <option>Insufficient evidence</option>
            </select>
          </label>
          <div className='mt-5 flex flex-wrap gap-2'>
            <button
              onClick={() => setDecision('More evidence requested')}
              className='rounded-xl border border-border px-3 py-2.5 text-[10px] font-semibold'
            >
              Request more evidence
            </button>
            <button
              onClick={() => setDecision('Approved for staff-mediated handover')}
              className='rounded-xl bg-primary px-3 py-2.5 text-[10px] font-semibold text-primary-foreground'
            >
              Approve for handover
            </button>
            <button
              onClick={() => setDecision('Claim not approved · reason recorded')}
              className='rounded-xl border border-rose-200 px-3 py-2.5 text-[10px] font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-200'
            >
              Decline claim
            </button>
          </div>
          {decision && (
            <div className='mt-4 rounded-xl bg-secondary p-3 text-xs font-semibold text-secondary-foreground'>
              Demo action recorded: {decision}. A real decision requires an authorized human
              reviewer.
            </div>
          )}
        </SectionCard>
      </div>
      <div className='grid gap-4 lg:grid-cols-[1fr_0.8fr]'>
        <SectionCard title='Case timeline' subtitle='Auditable, tenant-scoped actions'>
          <ActivityRows />
        </SectionCard>
        <SectionCard title='Next: coordinate a return'>
          <p className='text-xs leading-6 text-muted-foreground'>
            If staff verify a claim, use an institution-approved location and process. Record only
            the minimum handover outcome needed.
          </p>
          <Link
            href='/dashboard/cases'
            className='mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary'
          >
            View handovers <IconArrowRight size={14} />
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}

export function AccountView() {
  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='INDIVIDUAL ACCOUNT · DEMO'
        title='My reports and claims'
        description='Only your own reports, private claims and next steps appear here.'
        action={<ActionLink href='/dashboard/report'>New report</ActionLink>}
      />
      <DemoNotice />
      <div className='grid gap-4 lg:grid-cols-[1.3fr_0.7fr]'>
        <SectionCard
          title='My reports'
          subtitle='Three synthetic examples · not connected to a live account'
        >
          <div className='overflow-x-auto'>
            <table className='w-full min-w-[560px] text-left text-xs'>
              <thead>
                <tr className='border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground'>
                  <th className='pb-3 font-semibold'>Reference</th>
                  <th className='pb-3 font-semibold'>Report</th>
                  <th className='pb-3 font-semibold'>Institution</th>
                  <th className='pb-3 font-semibold'>Status</th>
                  <th className='pb-3 font-semibold'>Updated</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {[
                  [
                    'VF-0248',
                    'Found · dark laptop sleeve',
                    'Example University',
                    'Pending review',
                    'Today'
                  ],
                  [
                    'VM-0193',
                    'Missing · canvas backpack',
                    'Coastal Campus',
                    'Possible match',
                    'Yesterday'
                  ],
                  ['VF-0107', 'Found · backpack', 'Coastal Campus', 'Returned', '8 Oct']
                ].map((row) => (
                  <tr key={row[0]}>
                    <td className='py-3 font-mono text-[10px] font-semibold text-primary'>
                      {row[0]}
                    </td>
                    <td className='py-3 font-medium'>{row[1]}</td>
                    <td className='py-3 text-muted-foreground'>{row[2]} (Demo)</td>
                    <td className='py-3'>
                      <StatusPill
                        tone={
                          row[3] === 'Returned'
                            ? 'green'
                            : row[3] === 'Pending review'
                              ? 'amber'
                              : 'blue'
                        }
                      >
                        {row[3]}
                      </StatusPill>
                    </td>
                    <td className='py-3 text-muted-foreground'>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <SectionCard title='Private claim · CL-0219' subtitle='Blue water bottle · staff reviewed'>
          <StatusPill tone='amber'>Evidence requested</StatusPill>
          <p className='mt-3 text-xs leading-5 text-muted-foreground'>
            A reviewer asked for one identifying detail. Share it only through a private claim
            response, never through a public listing.
          </p>
          <button className='mt-4 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground'>
            Open private response
          </button>
          <div className='mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground'>
            Contact preferences · data request · privacy controls
          </div>
        </SectionCard>
      </div>
      <div className='grid gap-4 sm:grid-cols-3'>
        <SectionCard title='Contact preferences'>
          <p className='text-[11px] leading-5 text-muted-foreground'>
            Email notifications are not configured in this demo. Provider setup is deferred.
          </p>
          <StatusPill tone='neutral'>Notifications off</StatusPill>
        </SectionCard>
        <SectionCard title='Your data'>
          <p className='text-[11px] leading-5 text-muted-foreground'>
            Review or request changes to information associated with a real account.
          </p>
          <button className='mt-3 text-[11px] font-semibold text-primary'>Request my data</button>
        </SectionCard>
        <SectionCard title='Sign-in security'>
          <p className='text-[11px] leading-5 text-muted-foreground'>
            Account authentication is designed to use Supabase Auth when project variables are
            configured.
          </p>
          <Link
            href='/auth/sign-in'
            className='mt-3 inline-flex text-[11px] font-semibold text-primary'
          >
            Open sign in
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}

export function InstitutionOverview({ compact = false }: { compact?: boolean }) {
  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='INSTITUTION ADMIN · ONE TENANT'
        title={compact ? 'Institution overview' : 'Institution settings & reports'}
        description='Manage one synthetic institution workspace. This is not an approved partner deployment.'
        action={
          !compact ? (
            <button className='rounded-xl border border-border px-3.5 py-2.5 text-xs font-semibold'>
              Export demo summary
            </button>
          ) : undefined
        }
      />
      <DemoNotice>
        Example University is fictional demo data. DIT has not approved a pilot; no DIT logo or real
        records are used.
      </DemoNotice>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='Open cases' value='28' note='Example University · Demo' />
        <StatCard label='Awaiting review' value='6' note='Synthetic workload' accent='amber' />
        <StatCard label='Items returned' value='41' note='This month · demo only' accent='blue' />
        <StatCard label='Staff members' value='8' note='Fictional accounts' />
      </div>
      <div className='grid gap-4 lg:grid-cols-[1.25fr_0.75fr]'>
        <SectionCard
          title='Monthly case outcomes'
          subtitle='Synthetic values · no personal records'
        >
          <div className='flex h-40 items-end gap-3 border-b border-border px-1 pb-0 pt-5'>
            {[38, 58, 44, 76, 64, 84, 70, 92].map((height, index) => (
              <div key={index} className='flex flex-1 flex-col items-center gap-2'>
                <div
                  style={{ height: `${height}%` }}
                  className={`w-full rounded-t-md ${index === 7 ? 'bg-primary' : 'bg-[#b9d9cb] dark:bg-emerald-900'}`}
                />
                <span className='text-[9px] text-muted-foreground'>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M'][index]}
                </span>
              </div>
            ))}
          </div>
          <div className='mt-4 flex justify-between text-[10px] text-muted-foreground'>
            <span>Returned 41</span>
            <span>Still open 18</span>
            <span>Closed 14</span>
          </div>
        </SectionCard>
        <SectionCard title='Workspace readiness' subtitle='No real pilot authorized'>
          <div className='space-y-3'>
            {[
              ['Staff access review', 'Complete', 'green'],
              ['Retention policy', 'Draft', 'amber'],
              ['Support contact', 'Not configured', 'amber'],
              ['Pilot approval', 'Not granted', 'red']
            ].map(([label, value, tone]) => (
              <div
                key={label}
                className='flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0'
              >
                <span className='text-xs'>{label}</span>
                <StatusPill tone={tone === 'green' ? 'green' : tone === 'red' ? 'red' : 'amber'}>
                  {value}
                </StatusPill>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      <div className='grid gap-4 lg:grid-cols-2'>
        <SectionCard title='Staff and roles' subtitle='Least privilege · example users only'>
          <div className='divide-y divide-border'>
            {[
              ['Amina J.', 'Institution admin', 'Active'],
              ['Joseph M.', 'Case reviewer', 'Active'],
              ['Neema K.', 'Case reviewer', 'Invitation pending']
            ].map(([name, role, status]) => (
              <div key={name} className='flex items-center justify-between gap-2 py-3 first:pt-0'>
                <div>
                  <p className='text-xs font-semibold'>
                    {name} <span className='font-normal text-muted-foreground'>· {role}</span>
                  </p>
                </div>
                <StatusPill tone={status === 'Active' ? 'green' : 'amber'}>{status}</StatusPill>
              </div>
            ))}
          </div>
          <button className='mt-3 rounded-lg border border-border px-3 py-2 text-[10px] font-semibold'>
            Invite demo staff
          </button>
        </SectionCard>
        <SectionCard
          title='Categories & policies'
          subtitle='Configured for this synthetic workspace'
        >
          <div className='flex flex-wrap gap-2'>
            {[
              'Electronics',
              'Personal accessories',
              'Books & stationery',
              'Clothing',
              'Keys & cards',
              'Other'
            ].map((category) => (
              <span
                key={category}
                className='rounded-full bg-muted px-3 py-1.5 text-[10px] font-medium'
              >
                {category}
              </span>
            ))}
          </div>
          <p className='mt-4 text-[10px] leading-5 text-muted-foreground'>
            Public listings require staff review. No AI ownership decisions. Notification providers
            are not configured.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}

export function PlatformOverview({ compact = false }: { compact?: boolean }) {
  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='PLATFORM OWNER · AGGREGATE VIEW'
        title={compact ? 'Platform overview' : 'Platform operations'}
        description='See cross-institution aggregate health and onboarding status; case evidence remains tenant-scoped.'
        action={
          !compact ? (
            <button className='rounded-xl border border-border px-3.5 py-2.5 text-xs font-semibold'>
              Run demo checks
            </button>
          ) : undefined
        }
      />
      <DemoNotice>
        All institutions, figures and activity in this view are invented sample data. Platform-level
        reporting is aggregate by default.
      </DemoNotice>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <StatCard label='Demo institutions' value='3' note='No signed pilot partners' />
        <StatCard label='Open demo cases' value='105' note='Aggregate count only' accent='blue' />
        <StatCard label='Items returned' value='86' note='Synthetic records' />
        <StatCard label='Service health' value='99.9%' note='Illustrative availability' />
      </div>
      <div className='grid gap-4 lg:grid-cols-[1.15fr_0.85fr]'>
        <SectionCard
          title='Institution registry'
          subtitle='Proposed demo tenants · none imply endorsement'
        >
          <div className='space-y-3'>
            {demoInstitutions.map((institution) => (
              <div
                key={institution.name}
                className='flex flex-wrap items-center gap-3 rounded-xl border border-border p-3'
              >
                <span className='flex size-9 items-center justify-center rounded-xl bg-secondary text-secondary-foreground'>
                  <IconUsers size={16} />
                </span>
                <div className='min-w-[140px] flex-1'>
                  <p className='text-xs font-semibold'>
                    {institution.name}{' '}
                    <span className='font-normal text-muted-foreground'>(Demo)</span>
                  </p>
                  <p className='mt-1 text-[10px] text-muted-foreground'>
                    {institution.region} · {institution.items} fictional reports
                  </p>
                </div>
                <StatusPill tone='neutral'>{institution.status}</StatusPill>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title='Service indicators' subtitle='Sample status only'>
          <div className='grid gap-2 sm:grid-cols-2'>
            {[
              ['Go API', 'Healthy'],
              ['PostgreSQL', 'Healthy'],
              ['Python matching', 'Optional / off'],
              ['Email / SMS', 'Not configured'],
              ['Object storage', 'Healthy'],
              ['Queue worker', 'Healthy']
            ].map(([service, state]) => (
              <div key={service} className='rounded-xl border border-border p-3'>
                <div className='flex items-center gap-2 text-xs font-semibold'>
                  <span
                    className={`size-2 rounded-full ${state === 'Healthy' ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                  {service}
                </div>
                <p className='mt-1 text-[10px] text-muted-foreground'>{state}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
      <div className='grid gap-4 lg:grid-cols-2'>
        <SectionCard title='Moderation & safeguards' subtitle='Platform-level queue'>
          <div className='space-y-3 text-xs'>
            <div className='flex justify-between'>
              <span>Flagged demo reports</span>
              <StatusPill tone='amber'>4</StatusPill>
            </div>
            <div className='flex justify-between'>
              <span>Potential abuse</span>
              <StatusPill tone='blue'>2</StatusPill>
            </div>
            <div className='flex justify-between'>
              <span>Break-glass requests</span>
              <StatusPill tone='neutral'>0</StatusPill>
            </div>
          </div>
          <p className='mt-4 text-[10px] leading-5 text-muted-foreground'>
            Support access to case-level personal data should be reasoned, time-limited and audited.
          </p>
        </SectionCard>
        <SectionCard title='Aggregate activity · demo trend'>
          <div className='flex h-28 items-end gap-3 border-b border-border px-1'>
            {[32, 52, 40, 65, 54, 78, 68, 88].map((height, index) => (
              <div
                key={index}
                style={{ height: `${height}%` }}
                className={`flex-1 rounded-t-md ${index === 7 ? 'bg-primary' : 'bg-[#c7dfd2] dark:bg-emerald-900'}`}
              />
            ))}
          </div>
          <p className='mt-3 text-[10px] text-muted-foreground'>
            Tenant-level counts shown; no claimant or evidence details are aggregated into this
            view.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
