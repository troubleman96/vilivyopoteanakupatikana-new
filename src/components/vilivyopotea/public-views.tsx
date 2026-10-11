'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { IconCheck, IconSearch } from '@tabler/icons-react';
import { DemoNotice, ItemCard, PageHeading, StatusPill } from './primitives';
import {
  fetchPublicInstitutions,
  isApiConfigured,
  searchPublicItems,
  submitPrivateClaim,
  submitReport,
  toListingCard,
  type CreateReportInput,
  type PublicInstitution,
  type SearchRankingSource
} from '@/lib/api';
import { demoItems, type LostFoundItem } from '@/lib/demo-data';

const demoInstitutions: PublicInstitution[] = [
  {
    id: 'example-university',
    name: 'Example University (Demo)',
    region: 'Dar es Salaam, Tanzania · synthetic'
  },
  { id: 'coastal-campus', name: 'Coastal Campus (Demo)', region: 'Coastal region · synthetic' },
  {
    id: 'highland-institute',
    name: 'Highland Institute (Demo)',
    region: 'Northern zone · synthetic'
  }
];

const cardClass = 'rounded-2xl border border-border bg-card';

type ListingSource = 'api' | 'demo' | 'fallback';

function sourceNotice(source: ListingSource, ranking: SearchRankingSource | null) {
  if (source === 'api' && ranking === 'embeddinggemma')
    return 'EmbeddingGemma semantic ranking · reviewed public summaries only';
  if (source === 'api' && ranking === 'assistive_ai')
    return 'Local assistive ranking · reviewed public summaries only';
  if (source === 'api') return 'Text search · reviewed public summaries only';
  if (source === 'fallback') return 'API unavailable · showing fictional sample listings only';
  return 'Synthetic demo listings · no real records';
}

export function PublicSearchView() {
  const [items, setItems] = useState<LostFoundItem[]>(demoItems);
  const [source, setSource] = useState<ListingSource>('demo');
  const [ranking, setRanking] = useState<SearchRankingSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadMessage, setLoadMessage] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'All' | 'Found' | 'Missing'>('All');
  const [category, setCategory] = useState('All categories');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [claimStatement, setClaimStatement] = useState('');
  const [claimMessage, setClaimMessage] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      void (async () => {
        if (!isApiConfigured()) {
          if (mounted) {
            setItems(demoItems);
            setSource('demo');
            setRanking(null);
            setLoading(false);
          }
          return;
        }
        setLoading(true);
        try {
          const response = await searchPublicItems({
            query,
            kind: kind === 'All' ? undefined : kind === 'Found' ? 'found' : 'lost',
            category:
              category === 'All categories'
                ? undefined
                : category
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, '_')
                    .replace(/^_|_$/g, '')
          });
          if (mounted) {
            setItems(response.items.map(toListingCard));
            setSource('api');
            setRanking(response.source);
            setLoadMessage('');
          }
        } catch {
          if (mounted) {
            setItems(demoItems);
            setSource('fallback');
            setRanking(null);
            setLoadMessage(
              'The public API could not be reached. These examples are fictional and were not returned by the service.'
            );
          }
        } finally {
          if (mounted) setLoading(false);
        }
      })();
    }, 250);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query, kind, category]);

  const categories = useMemo(
    () => [
      'All categories',
      ...Array.from(
        new Set([
          ...items.map((item) => item.category),
          'Electronics',
          'Accessories',
          'Keys',
          'Bags',
          'Books',
          'Other'
        ])
      )
    ],
    [items]
  );
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items.filter((item) => {
      const text = `${item.title} ${item.category} ${item.place} ${item.description}`.toLowerCase();
      return (
        (source === 'api' || text.includes(normalizedQuery)) &&
        (kind === 'All' || item.kind === kind) &&
        (category === 'All categories' || item.category === category)
      );
    });
  }, [items, query, kind, category, source]);
  const activeItem = items.find((item) => item.id === selectedId);

  async function handleClaim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClaimMessage('');
    if (!activeItem || claimStatement.trim().length < 8) {
      setClaimMessage('Add a short private explanation before continuing.');
      return;
    }
    if (source !== 'api') {
      setClaimMessage(
        'Demo only: this sample claim stays in this browser preview and is not sent anywhere.'
      );
      return;
    }
    setClaimBusy(true);
    try {
      await submitPrivateClaim(activeItem.id, claimStatement.trim());
      setClaimMessage(
        'Private claim submitted for staff review. Your statement is not shown on the public listing.'
      );
      setClaimStatement('');
    } catch (error) {
      setClaimMessage(
        error instanceof Error
          ? error.message
          : 'The claim could not be submitted. Please try again.'
      );
    } finally {
      setClaimBusy(false);
    }
  }

  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='PUBLIC DISCOVERY · REVIEWED LISTINGS ONLY'
        title='Search lost and found'
        description='Browse safe public summaries. A possible match is only a starting point—staff verify all claims.'
      />
      <div className={`${cardClass} p-4 sm:p-5`}>
        <div className='mb-3 flex flex-wrap items-center justify-between gap-2'>
          <label htmlFor='item-search' className='text-xs font-semibold'>
            Search a general description
          </label>
          <span className='rounded-full bg-secondary px-2.5 py-1 text-[9px] font-semibold text-secondary-foreground'>
            {sourceNotice(source, ranking)}
          </span>
        </div>
        <div className='flex flex-col gap-3 sm:flex-row'>
          <div className='relative flex-1'>
            <IconSearch className='absolute left-3 top-3 size-4 text-muted-foreground' />
            <input
              id='item-search'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder='e.g. blue bottle, dark laptop sleeve'
              className='h-10 w-full rounded-xl border border-input bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring'
            />
          </div>
          <select
            aria-label='Filter by category'
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className='h-10 rounded-xl border border-input bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring'
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className='mt-4 flex flex-wrap gap-2'>
          {(['All', 'Found', 'Missing'] as const).map((choice) => (
            <button
              type='button'
              key={choice}
              onClick={() => setKind(choice)}
              aria-pressed={kind === choice}
              className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${kind === choice ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
            >
              {choice}
            </button>
          ))}
          <span className='ml-auto self-center text-[10px] text-muted-foreground'>
            {loading ? 'Loading listings…' : `${filtered.length} reviewed listings`}
          </span>
        </div>
      </div>
      {loadMessage && (
        <div
          role='status'
          className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
        >
          {loadMessage}
        </div>
      )}
      {activeItem && (
        <section className={`${cardClass} p-4 sm:p-5`} aria-labelledby='listing-detail-title'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <StatusPill tone='green'>{activeItem.kind} · reviewed</StatusPill>
              <h2 id='listing-detail-title' className='mt-2 text-base font-bold'>
                {activeItem.title}
              </h2>
              <p className='mt-1 text-[10px] text-muted-foreground'>
                {activeItem.category} · {activeItem.place} · {activeItem.date}
              </p>
            </div>
            <button
              type='button'
              onClick={() => {
                setSelectedId(null);
                setClaimMessage('');
              }}
              className='rounded-lg border border-border px-3 py-2 text-[10px] font-semibold'
            >
              Close details
            </button>
          </div>
          <p className='mt-3 max-w-3xl text-xs leading-6 text-muted-foreground'>
            {activeItem.description}
          </p>
          <div className='mt-4 rounded-lg bg-amber-50 p-3 text-[10px] leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100'>
            Safe public summary · distinctive identifying details and contact information are
            intentionally withheld.
          </div>
          <form onSubmit={handleClaim} className='mt-4 max-w-2xl'>
            <label htmlFor='private-claim' className='block text-xs font-semibold'>
              Private claim statement{' '}
              <span className='font-normal text-muted-foreground'>· never posted publicly</span>
            </label>
            <textarea
              id='private-claim'
              value={claimStatement}
              onChange={(event) => setClaimStatement(event.target.value)}
              minLength={8}
              maxLength={2000}
              rows={3}
              className='form-control mt-2 resize-y'
              placeholder='Describe one private detail that can help staff verify this is yours. Do not share it in public text.'
              required
            />
            <div className='mt-3 flex flex-wrap items-center gap-3'>
              <button
                type='submit'
                disabled={claimBusy}
                className='rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-60'
              >
                {claimBusy
                  ? 'Submitting…'
                  : source === 'api'
                    ? 'Submit private claim'
                    : 'Save demo claim'}
              </button>
              {source === 'api' && (
                <Link
                  href='/auth/sign-in'
                  className='text-[11px] font-semibold text-primary hover:underline'
                >
                  Sign in to claim
                </Link>
              )}
            </div>
            {claimMessage && (
              <p
                role='status'
                className='mt-3 rounded-lg bg-secondary p-3 text-xs leading-5 text-secondary-foreground'
              >
                {claimMessage}
                {claimMessage.startsWith('Sign in') && (
                  <>
                    {' '}
                    <Link href='/auth/sign-in' className='font-semibold underline'>
                      Sign in
                    </Link>{' '}
                    or{' '}
                    <Link href='/auth/sign-up' className='font-semibold underline'>
                      create an account
                    </Link>
                    .
                  </>
                )}
              </p>
            )}
          </form>
        </section>
      )}
      {filtered.length > 0 ? (
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
          {filtered.map((item) => (
            <div key={item.id} className='relative'>
              <ItemCard item={item} />
              <button
                type='button'
                onClick={() => {
                  setSelectedId(item.id);
                  setClaimStatement('');
                  setClaimMessage('');
                }}
                className='absolute bottom-4 right-4 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[10px] font-semibold text-primary hover:bg-secondary'
              >
                Safe details / claim
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className={`${cardClass} px-6 py-12 text-center`}>
          <h2 className='text-sm font-bold'>
            {loading ? 'Loading listings' : 'No matching listings'}
          </h2>
          <p className='mt-1 text-xs text-muted-foreground'>
            {loading
              ? 'Please wait while reviewed summaries load.'
              : 'Try a wider description or clear a filter.'}
          </p>
        </div>
      )}
      <DemoNotice>
        Only reviewed, public-safe summaries are shown. Personal contact details, claims and
        verification evidence stay private.{' '}
        {source !== 'api' && 'Current cards are fictional demo data.'}
      </DemoNotice>
    </div>
  );
}

export function PublicReportView() {
  const [institutions, setInstitutions] = useState<PublicInstitution[]>(demoInstitutions);
  const [institutionSource, setInstitutionSource] = useState<ListingSource>('demo');
  const [loadingInstitutions, setLoadingInstitutions] = useState(true);
  const [form, setForm] = useState<CreateReportInput>({
    institution_id: '',
    kind: 'found',
    category: '',
    title: '',
    description: '',
    location: '',
    occurred_on: '',
    contact_details: ''
  });
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [result, setResult] = useState<{ id: string; demo: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;
    async function loadInstitutions() {
      if (!isApiConfigured()) {
        if (mounted) {
          setInstitutions(demoInstitutions);
          setInstitutionSource('demo');
          setForm((current) => ({
            ...current,
            institution_id: current.institution_id || demoInstitutions[0].id
          }));
          setLoadingInstitutions(false);
        }
        return;
      }
      try {
        const data = await fetchPublicInstitutions();
        if (mounted) {
          setInstitutions(data);
          setInstitutionSource('api');
          setForm((current) => ({
            ...current,
            institution_id: current.institution_id || data[0]?.id || ''
          }));
        }
      } catch {
        if (mounted) {
          setInstitutions(demoInstitutions);
          setInstitutionSource('fallback');
          setError(
            'The institution list could not be loaded. No report can be sent until the API is reachable.'
          );
        }
      } finally {
        if (mounted) setLoadingInstitutions(false);
      }
    }
    void loadInstitutions();
    return () => {
      mounted = false;
    };
  }, []);

  function update<K extends keyof CreateReportInput>(key: K, value: CreateReportInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNeedsSignIn(false);
    if (!isApiConfigured()) {
      setResult({ id: `DEMO-${new Date().getFullYear()}-LOCAL`, demo: true });
      return;
    }
    if (institutionSource !== 'api') {
      setError('The live institution directory is unavailable. This form has not been submitted.');
      return;
    }
    setBusy(true);
    try {
      const response = await submitReport(form);
      setResult({ id: response.id, demo: false });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : 'The report could not be submitted. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className='mx-auto max-w-2xl space-y-5 py-10 text-center'>
        <div className='mx-auto flex size-14 items-center justify-center rounded-full bg-secondary text-primary'>
          <IconCheck size={26} />
        </div>
        <PageHeading
          eyebrow={result.demo ? 'DEMO CONFIRMATION' : 'REPORT RECEIVED'}
          title={result.demo ? 'Demo report saved locally' : 'Report submitted for review'}
          description={
            result.demo
              ? 'This sample was kept in this browser preview only. No real record was sent.'
              : 'The report is private and will not appear in public search unless staff create and approve a safe summary.'
          }
        />
        <div className='mx-auto max-w-sm rounded-2xl border border-border bg-card p-5'>
          <p className='text-[10px] uppercase tracking-widest text-muted-foreground'>Reference</p>
          <p className='mt-1 break-all font-mono text-sm font-bold'>{result.id}</p>
          <StatusPill tone='amber'>Pending staff review</StatusPill>
        </div>
        <DemoNotice>
          Keep identifying clues private. A public listing is created only after authorized staff
          review.
        </DemoNotice>
        <div className='flex justify-center gap-3'>
          <Link
            href='/dashboard/search'
            className='rounded-xl border border-border px-4 py-2.5 text-xs font-semibold'
          >
            Back to search
          </Link>
          <button
            type='button'
            onClick={() => {
              setResult(null);
              setStep(1);
              setForm((current) => ({
                ...current,
                title: '',
                description: '',
                location: '',
                occurred_on: '',
                contact_details: ''
              }));
            }}
            className='rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground'
          >
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='PUBLIC REPORTING'
        title={`Report a ${form.kind === 'found' ? 'found' : 'missing'} item`}
        description='Share enough for staff to review, but keep distinctive proof and contact details private.'
      />
      {institutionSource === 'fallback' && (
        <div
          role='alert'
          className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
        >
          {error}
        </div>
      )}
      <div className='grid gap-5 lg:grid-cols-[1fr_300px]'>
        <form onSubmit={handleSubmit} className={`${cardClass} space-y-4 p-4 sm:p-6`}>
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
                  {(
                    [
                      { value: 'found', label: 'Found item' },
                      { value: 'lost', label: 'Missing item' }
                    ] as const
                  ).map((choice) => (
                    <button
                      type='button'
                      key={choice.value}
                      onClick={() => update('kind', choice.value)}
                      aria-pressed={form.kind === choice.value}
                      className={`rounded-xl border px-4 py-3 text-left text-xs font-semibold ${form.kind === choice.value ? 'border-primary bg-secondary text-secondary-foreground' : 'border-border hover:bg-muted'}`}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className='block text-xs font-semibold'>
                Institution or search area
                <select
                  required
                  disabled={loadingInstitutions || institutions.length === 0}
                  value={form.institution_id}
                  onChange={(event) => update('institution_id', event.target.value)}
                  className='form-control mt-2'
                >
                  <option value=''>
                    {loadingInstitutions ? 'Loading institutions…' : 'Choose an institution'}
                  </option>
                  {institutions.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name} · {institution.region}
                    </option>
                  ))}
                </select>
              </label>
              <label className='block text-xs font-semibold'>
                Category
                <select
                  required
                  value={form.category}
                  onChange={(event) => update('category', event.target.value)}
                  className='form-control mt-2'
                >
                  <option value=''>Choose a category</option>
                  <option value='electronics'>Electronics</option>
                  <option value='accessories'>Personal accessories</option>
                  <option value='keys'>Keys and cards</option>
                  <option value='bags'>Bags</option>
                  <option value='books'>Books and stationery</option>
                  <option value='other'>Other</option>
                </select>
              </label>
              <label className='block text-xs font-semibold'>
                {form.kind === 'found' ? 'Approximate date found' : 'Approximate date last seen'}
                <input
                  type='date'
                  value={form.occurred_on}
                  onChange={(event) => update('occurred_on', event.target.value)}
                  className='form-control mt-2'
                />
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <label className='block text-xs font-semibold'>
                Short general description
                <input
                  required
                  minLength={4}
                  maxLength={120}
                  value={form.title}
                  onChange={(event) => update('title', event.target.value)}
                  className='form-control mt-2'
                  placeholder='e.g. dark padded laptop sleeve'
                />
              </label>
              <label className='block text-xs font-semibold'>
                Additional description
                <textarea
                  required
                  minLength={8}
                  maxLength={2000}
                  rows={4}
                  value={form.description}
                  onChange={(event) => update('description', event.target.value)}
                  className='form-control mt-2 resize-y'
                  placeholder='Describe it generally. Keep one or more unique clues private.'
                />
              </label>
              <label className='block text-xs font-semibold'>
                Approximate area
                <input
                  maxLength={120}
                  value={form.location}
                  onChange={(event) => update('location', event.target.value)}
                  className='form-control mt-2'
                  placeholder='e.g. library area, lecture hall'
                />
              </label>
              <div className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'>
                Do not include phone numbers, student IDs, serial numbers, exact addresses or unique
                identifying marks in general descriptions.
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className='text-sm font-bold'>Private follow-up and review</h2>
              <label className='block text-xs font-semibold'>
                Optional private contact detail for staff
                <input
                  maxLength={320}
                  value={form.contact_details}
                  onChange={(event) => update('contact_details', event.target.value)}
                  className='form-control mt-2'
                  placeholder='Email or phone · visible only to authorized staff'
                />
                <span className='mt-1 block text-[10px] font-normal text-muted-foreground'>
                  Stored separately from the public summary. Do not add contact details to the
                  description above.
                </span>
              </label>
              <div className='rounded-xl bg-muted/60 p-4 text-xs leading-6 text-muted-foreground'>
                Your report is held privately pending staff review. It will not appear in public
                search until authorized staff approve a redacted public summary.
              </div>
              <label className='flex gap-2 text-xs leading-5'>
                <input type='checkbox' required className='mt-1 accent-primary' />I understand this
                submission is for lost-and-found follow-up and staff may review the details
                privately.
              </label>
            </>
          )}
          <div className='flex flex-wrap gap-2 border-t border-border pt-4'>
            {step > 1 && (
              <button
                type='button'
                onClick={() => {
                  setStep(step - 1);
                  setError('');
                }}
                className='rounded-xl border border-border px-4 py-2.5 text-xs font-semibold'
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type='button'
                disabled={
                  (step === 1 && (!form.institution_id || !form.category || loadingInstitutions)) ||
                  (step === 2 &&
                    (form.title.trim().length < 4 || form.description.trim().length < 8))
                }
                onClick={() => {
                  setError('');
                  setStep(step + 1);
                }}
                className='rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50'
              >
                Continue
              </button>
            ) : (
              <button
                type='submit'
                disabled={
                  busy || loadingInstitutions || (isApiConfigured() && institutionSource !== 'api')
                }
                className='rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50'
              >
                {busy
                  ? 'Submitting…'
                  : isApiConfigured()
                    ? 'Submit report privately'
                    : 'Save demo report locally'}
              </button>
            )}
            <span className='self-center text-[10px] text-muted-foreground'>
              Private claims · people verify
            </span>
          </div>
          {needsSignIn && (
            <p
              role='status'
              className='rounded-xl bg-secondary p-3 text-xs leading-5 text-secondary-foreground'
            >
              Sign in to your local account to send this report.{' '}
              <Link href='/auth/sign-in' className='font-semibold underline'>
                Sign in
              </Link>{' '}
              or{' '}
              <Link href='/auth/sign-up' className='font-semibold underline'>
                create an account
              </Link>
              .
            </p>
          )}
          {error && institutionSource !== 'fallback' && (
            <p
              role='alert'
              className='rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            >
              {error}
            </p>
          )}
        </form>
        <aside className='space-y-4'>
          <section className={`${cardClass} p-4`}>
            <h2 className='text-sm font-bold'>Before you continue</h2>
            <p className='mt-1 text-[10px] text-muted-foreground'>
              {institutionSource === 'api'
                ? 'Live institution directory'
                : 'Synthetic preview · no live institution selected'}
            </p>
            <ul className='mt-4 space-y-3 text-[11px] leading-5 text-muted-foreground'>
              <li>Share only a general description and approximate area.</li>
              <li>Keep unique clues and contact details private.</li>
              <li>Found-item summaries require staff review before publication.</li>
              <li>Claims and evidence are handled privately by staff.</li>
            </ul>
          </section>
          <DemoNotice>
            This interface does not upload photos or evidence. A real service needs approved, secure
            storage and retention controls.
          </DemoNotice>
        </aside>
      </div>
    </div>
  );
}
