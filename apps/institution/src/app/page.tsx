'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ComponentType } from 'react';
import { Icons } from '@/components/icons';
import {
  cases,
  claims,
  currentAccount,
  institutions,
  recordHandover,
  reviewClaim,
  reviewItem,
  stats,
  updateCase,
  verifyClaim,
  type CaseRecord,
  type Claim,
  type Institution,
  type Stats
} from '@/lib/api';

const productURL = process.env.NEXT_PUBLIC_PRODUCT_APP_URL ?? 'http://localhost:3000';
type Section = 'overview' | 'cases' | 'claims';
const nav: [Section, string, typeof Icons.cases][] = [
  ['overview', 'Overview', Icons.institution],
  ['cases', 'Case queue', Icons.cases],
  ['claims', 'Claim review', Icons.claims]
];

export default function InstitutionHome() {
  const [account, setAccount] = useState<{ id: string; email: string } | null>(null);
  const [directory, setDirectory] = useState<Institution[]>([]);
  const [institutionID, setInstitutionID] = useState('');
  const [caseRows, setCaseRows] = useState<CaseRecord[]>([]);
  const [claimRows, setClaimRows] = useState<Claim[]>([]);
  const [metrics, setMetrics] = useState<Stats | null>(null);
  const [section, setSection] = useState<Section>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileNavOpen]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [publicDrafts, setPublicDrafts] = useState<
    Record<string, { title: string; description: string; location: string }>
  >({});
  const [verification, setVerification] = useState<
    Record<string, { method: string; note: string }>
  >({});
  const selected = useMemo(
    () => directory.find((item) => item.id === institutionID),
    [directory, institutionID]
  );
  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const who = await currentAccount();
      setAccount(who);
      const orgs = await institutions();
      setDirectory(orgs);
      const id = institutionID || orgs[0]?.id || '';
      setInstitutionID(id);
      if (id) {
        const [cs, cl, st] = await Promise.all([cases(id), claims(id), stats(id)]);
        setCaseRows(cs);
        setClaimRows(cl);
        setMetrics(st);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the institution workspace.');
    } finally {
      setLoading(false);
    }
  }, [institutionID]);
  useEffect(() => {
    void load();
  }, []);
  async function changeInstitution(id: string) {
    setInstitutionID(id);
    setLoading(true);
    setError('');
    try {
      const [cs, cl, st] = await Promise.all([cases(id), claims(id), stats(id)]);
      setCaseRows(cs);
      setClaimRows(cl);
      setMetrics(st);
    } catch (e) {
      setCaseRows([]);
      setClaimRows([]);
      setMetrics(null);
      setError(
        e instanceof Error ? e.message : 'This institution is not accessible to your account.'
      );
    } finally {
      setLoading(false);
    }
  }
  async function doReview(claim: Claim, status: string) {
    setBusy(true);
    setError('');
    try {
      await reviewClaim(institutionID, claim.id, status, 'Reviewed in institution workspace');
      setClaimRows((rows) => rows.map((row) => (row.id === claim.id ? { ...row, status } : row)));
      setNotice(`Claim ${status.replace('_', ' ')}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim review failed.');
    } finally {
      setBusy(false);
    }
  }
  async function doCase(row: CaseRecord, status: string) {
    setBusy(true);
    setError('');
    try {
      await updateCase(institutionID, row.id, status);
      setCaseRows((rows) => rows.map((item) => (item.id === row.id ? { ...item, status } : item)));
      setNotice('Case status updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Case update failed.');
    } finally {
      setBusy(false);
    }
  }
  async function doItemReview(row: CaseRecord, status: 'approved' | 'rejected') {
    const draft = publicDrafts[row.item_id] ?? { title: '', description: '', location: '' };
    if (status === 'approved' && !draft.title.trim()) {
      setError('Add a public-safe title before approving this item.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await reviewItem(institutionID, row.item_id, status, {
        public_title: draft.title.trim(),
        public_description: draft.description.trim(),
        public_location: draft.location.trim()
      });
      setCaseRows((rows) =>
        rows.map((item) =>
          item.item_id === row.item_id
            ? {
                ...item,
                review_status: result.review_status,
                visibility: result.visibility,
                public_title: draft.title,
                public_description: draft.description,
                public_location: draft.location
              }
            : item
        )
      );
      setNotice(status === 'approved' ? 'Public-safe summary approved.' : 'Item review rejected.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Item review failed.');
    } finally {
      setBusy(false);
    }
  }
  async function doVerify(row: Claim) {
    const draft = verification[row.id] ?? { method: 'in_person', note: '' };
    setBusy(true);
    setError('');
    try {
      const result = await verifyClaim(institutionID, row.id, draft.method, draft.note);
      setClaimRows((rows) =>
        rows.map((claim) =>
          claim.id === row.id
            ? { ...claim, verification_method: draft.method, verified_at: result.verified_at }
            : claim
        )
      );
      setNotice('Claim verification recorded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim verification failed.');
    } finally {
      setBusy(false);
    }
  }
  async function doHandover(event: React.FormEvent<HTMLFormElement>, row: CaseRecord) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const claimID = String(form.get('claim_id'));
    const handoverAt = String(form.get('handover_at'));
    if (!claimID || !handoverAt) {
      setError('Select a verified approved claim and handover time.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await recordHandover(institutionID, row.id, {
        claim_id: claimID,
        handover_at: new Date(handoverAt).toISOString(),
        recipient: String(form.get('recipient')).trim(),
        details: String(form.get('details')).trim()
      });
      setCaseRows((rows) =>
        rows.map((item) => (item.id === row.id ? { ...item, status: 'returned' } : item))
      );
      setNotice('Private handover recorded.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Handover could not be recorded.');
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    try {
      await fetch(
        `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1').replace(/\/+$/, '')}/auth/logout`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        }
      );
    } finally {
      window.location.href = `${productURL}/auth/sign-in`;
    }
  }
  return (
    <div
      className='min-h-screen bg-background text-foreground lg:grid'
      style={{
        gridTemplateColumns: sidebarCollapsed ? '3rem minmax(0, 1fr)' : '16rem minmax(0, 1fr)'
      }}
    >
      {mobileNavOpen && (
        <button
          aria-label='Close navigation'
          onClick={() => setMobileNavOpen(false)}
          className='fixed inset-0 z-40 bg-black/40 lg:hidden'
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-sidebar-border bg-sidebar px-3 py-3 text-sidebar-foreground transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:w-auto lg:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} ${sidebarCollapsed ? 'lg:items-center lg:px-1' : ''}`}
      >
        <Link href={productURL} className='flex items-center gap-3'>
          <span
            className={`grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground ${sidebarCollapsed ? 'lg:size-8' : ''}`}
          >
            <Icons.shield size={21} />
          </span>
          <span className={sidebarCollapsed ? 'lg:hidden' : ''}>
            <b className='block text-sm'>Vilivyopotea</b>
            <span className='text-[11px] text-muted-foreground'>Institution workspace</span>
          </span>
        </Link>
        <div
          className={`mt-8 px-2 text-[10px] font-medium text-muted-foreground ${sidebarCollapsed ? 'lg:hidden' : ''}`}
        >
          Institution &amp; security operations
        </div>
        <nav aria-label='Primary navigation' className='mt-2 grid grid-cols-1 gap-1'>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                setMobileNavOpen(false);
              }}
              className={`mb-1 flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition ${section === id ? 'bg-sidebar-accent font-medium text-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'} ${sidebarCollapsed ? 'lg:justify-center lg:px-0' : ''}`}
            >
              <Icon size={18} stroke={1.7} />
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{label}</span>
            </button>
          ))}
        </nav>
        <div
          className={`mt-5 rounded-lg border border-sidebar-border bg-card p-3 text-foreground lg:mt-auto ${sidebarCollapsed ? 'lg:hidden' : ''}`}
        >
          <div className='flex items-center gap-2 text-xs font-semibold'>
            <span className='size-2 rounded-full bg-primary' />
            {account?.email ?? 'Session check'}
          </div>
          <p className='mt-2 text-[11px] leading-5 text-muted-foreground'>
            Institution access is checked by the API for every operation.
          </p>
          <button
            onClick={() => void signOut()}
            className='mt-3 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground'
          >
            <Icons.logout size={15} />
            Sign out
          </button>
        </div>
      </aside>
      <main className='min-w-0 w-full'>
        <div className='sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6 lg:px-8'>
          <button
            type='button'
            aria-label={sidebarCollapsed ? 'Expand navigation' : 'Toggle navigation'}
            className='inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground'
            onClick={() => {
              if (window.matchMedia('(min-width: 1024px)').matches)
                setSidebarCollapsed((value) => !value);
              else setMobileNavOpen(true);
            }}
          >
            <Icons.panelLeft size={18} />
          </button>
          <span className='h-4 w-px bg-border' />
          <span className='text-sm font-medium'>Institution workspace</span>
        </div>
        <div className='mx-auto w-full max-w-screen-2xl px-4 pb-8 pt-5 sm:px-6 sm:pt-7 lg:px-8'>
          <header className='flex flex-wrap items-end justify-between gap-4'>
            <div>
              <p className='text-[11px] font-semibold uppercase tracking-[.16em] text-primary'>
                STAFF WORKSPACE · PRE-PILOT
              </p>
              <h1 className='mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-[38px]'>
                {section === 'overview'
                  ? 'Institution overview'
                  : section === 'cases'
                    ? 'Case queue'
                    : 'Claim review'}
              </h1>
              <p className='mt-2 max-w-2xl text-sm leading-6 text-muted-foreground'>
                Manage reported lost and found items with authorized, institution-scoped access.
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <label className='sr-only' htmlFor='institution'>
                Institution
              </label>
              <div className='relative'>
                <select
                  id='institution'
                  value={institutionID}
                  onChange={(e) => void changeInstitution(e.target.value)}
                  className='max-w-[240px] appearance-none rounded-lg border bg-card py-2.5 pl-3 pr-9 text-sm'
                >
                  <option value=''>Choose institution</option>
                  {directory.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <Icons.chevronDown
                  size={15}
                  className='pointer-events-none absolute right-3 top-3 text-muted-foreground'
                />
              </div>
              <button
                aria-label='Refresh data'
                onClick={() => void load()}
                className='grid size-10 place-items-center rounded-lg border bg-card text-muted-foreground hover:text-[var(--green)]'
              >
                <Icons.refresh size={17} />
              </button>
            </div>
          </header>
          <div className='mt-7 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground'>
            <span className='size-2 rounded-full bg-[#e0a640]' />
            <strong className='text-foreground'>Pre-pilot workspace</strong>
            <span>· fictional demo records only · no institution approval is implied</span>
          </div>
          {error && (
            <div
              role='alert'
              className='mt-5 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive'
            >
              {error}
              {error.toLowerCase().includes('sign') || error.toLowerCase().includes('session') ? (
                <Link className='ml-2 font-semibold underline' href={`${productURL}/auth/sign-in`}>
                  Sign in
                </Link>
              ) : null}
            </div>
          )}
          {notice && (
            <div
              role='status'
              className='mt-4 rounded-xl bg-[var(--soft)] px-4 py-3 text-sm text-[var(--green)]'
            >
              {notice}
            </div>
          )}
          {!loading && account && directory.length === 0 ? (
            <div className='mt-5 rounded-lg border bg-card p-5 text-sm text-muted-foreground'>
              Your account has no active institution membership yet. Ask a platform administrator to
              assign your verified account to an institution.
            </div>
          ) : null}
          {loading ? (
            <div className='mt-8 rounded-3xl border bg-card p-8 text-sm text-muted-foreground'>
              Checking your session and loading institution data…
            </div>
          ) : section === 'overview' ? (
            <>
              <div className='mt-7'>
                <p className='text-sm font-semibold'>{selected?.name ?? 'Select an institution'}</p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  {selected?.region ??
                    'Choose an institution to view data authorized for your account.'}
                </p>
              </div>
              <div className='mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                {(
                  [
                    {
                      title: 'Open cases',
                      value: metrics?.open_cases ?? '—',
                      Icon: Icons.cases,
                      note: 'Cases currently in progress'
                    },
                    {
                      title: 'Pending claims',
                      value: metrics?.open_claims ?? '—',
                      Icon: Icons.claims,
                      note: 'Awaiting a staff decision'
                    },
                    {
                      title: 'Queue records',
                      value: caseRows.length,
                      Icon: Icons.activity,
                      note: 'Returned by your authorized API'
                    }
                  ] satisfies {
                    title: string;
                    value: string | number;
                    Icon: ComponentType<{ size?: number }>;
                    note: string;
                  }[]
                ).map((card) => (
                  <article key={card.title} className='rounded-lg border bg-card p-5'>
                    <div className='flex items-start justify-between'>
                      <span className='text-sm text-muted-foreground'>{card.title}</span>
                      <span className='grid size-9 place-items-center rounded-xl bg-[var(--soft)] text-[var(--green)]'>
                        <card.Icon size={18} />
                      </span>
                    </div>
                    <div className='mt-5 text-3xl font-semibold'>{card.value}</div>
                    <p className='mt-1 text-xs text-muted-foreground'>{card.note}</p>
                  </article>
                ))}
              </div>
              <section className='mt-6 grid gap-4 xl:grid-cols-[1.2fr_.8fr]'>
                <div className='rounded-lg border bg-card p-5'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-base font-semibold'>Your work queues</h2>
                    <span className='text-[11px] text-muted-foreground'>
                      {selected?.name ?? 'No institution selected'}
                    </span>
                  </div>
                  <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                    <button
                      onClick={() => setSection('cases')}
                      className='flex items-center justify-between rounded-lg border p-4 text-left hover:border-primary'
                    >
                      <span>
                        <b className='block text-sm'>Case queue</b>
                        <span className='mt-1 block text-xs text-muted-foreground'>
                          {caseRows.length} cases returned
                        </span>
                      </span>
                      <Icons.arrow size={17} />
                    </button>
                    <button
                      onClick={() => setSection('claims')}
                      className='flex items-center justify-between rounded-lg border p-4 text-left hover:border-primary'
                    >
                      <span>
                        <b className='block text-sm'>Claim review</b>
                        <span className='mt-1 block text-xs text-muted-foreground'>
                          {claimRows.length} claims returned
                        </span>
                      </span>
                      <Icons.arrow size={17} />
                    </button>
                  </div>
                </div>
                <div className='rounded-xl border bg-primary/10 p-5'>
                  <div className='flex items-center gap-2 text-sm font-semibold text-primary-foreground'>
                    <Icons.shield size={18} />
                    Built around careful handling
                  </div>
                  <ul className='mt-3 space-y-2 text-xs leading-5 text-muted-foreground'>
                    <li>Private claimant details stay within the authorized staff API.</li>
                    <li>Only staff can review and update institution records.</li>
                    <li>Every write is checked by the Go API and recorded for audit.</li>
                  </ul>
                </div>
              </section>
            </>
          ) : section === 'cases' ? (
            <section className='mt-7 space-y-3'>
              {caseRows.length === 0 ? (
                <Empty>There are no case records available in this authorized queue.</Empty>
              ) : (
                caseRows.map((row) => {
                  const draft = publicDrafts[row.item_id] ?? {
                    title: row.public_title || row.private_title,
                    description: row.public_description || row.private_description,
                    location: row.public_location || row.private_location
                  };
                  const eligibleClaims = claimRows.filter(
                    (claim) =>
                      claim.item_id === row.item_id &&
                      claim.status === 'approved' &&
                      claim.verified_at
                  );
                  return (
                    <article key={row.id} className='rounded-lg border bg-card p-5'>
                      <div className='flex flex-wrap items-start justify-between gap-4'>
                        <div>
                          <p className='font-mono text-[10px] text-muted-foreground'>
                            CASE {row.id.slice(0, 8)}
                          </p>
                          <h2 className='mt-1 text-base font-semibold'>
                            {row.private_title || `${row.kind} item`}{' '}
                            <span className='font-normal text-muted-foreground'>
                              · {row.category}
                            </span>
                          </h2>
                          <p className='mt-2 max-w-3xl text-sm leading-6 text-muted-foreground'>
                            {row.private_description}
                          </p>
                          <p className='mt-2 text-xs text-muted-foreground'>
                            Private location: {row.private_location || 'Not provided'} · review:{' '}
                            {row.review_status} · visibility: {row.visibility}
                          </p>
                        </div>
                        <span className='rounded-full bg-muted px-3 py-1.5 text-xs font-semibold'>
                          {row.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className='mt-4 flex flex-wrap gap-2'>
                        {['open', 'under_review', 'matched', 'closed'].map((status) => (
                          <button
                            key={status}
                            disabled={busy || row.status === status || row.status === 'returned'}
                            onClick={() => void doCase(row, status)}
                            className='rounded-lg border px-3 py-2 text-xs font-medium capitalize hover:border-primary disabled:opacity-40'
                          >
                            {status.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                      {row.review_status !== 'approved' ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void doItemReview(row, 'approved');
                          }}
                          className='mt-5 rounded-xl bg-muted p-4'
                        >
                          <p className='text-sm font-semibold'>Create a public-safe summary</p>
                          <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                            Remove names, contacts, precise identifying details, and withheld
                            evidence before publishing.
                          </p>
                          <div className='mt-3 grid gap-2'>
                            <input
                              aria-label='Public title'
                              value={draft.title}
                              onChange={(e) =>
                                setPublicDrafts((all) => ({
                                  ...all,
                                  [row.item_id]: { ...draft, title: e.target.value }
                                }))
                              }
                              maxLength={120}
                              placeholder='General item title'
                              className='rounded-lg border bg-card px-3 py-2 text-sm'
                            />
                            <textarea
                              aria-label='Public description'
                              value={draft.description}
                              onChange={(e) =>
                                setPublicDrafts((all) => ({
                                  ...all,
                                  [row.item_id]: { ...draft, description: e.target.value }
                                }))
                              }
                              maxLength={2000}
                              rows={2}
                              placeholder='Redacted description'
                              className='rounded-lg border bg-card px-3 py-2 text-sm'
                            />
                            <input
                              aria-label='Public location'
                              value={draft.location}
                              onChange={(e) =>
                                setPublicDrafts((all) => ({
                                  ...all,
                                  [row.item_id]: { ...draft, location: e.target.value }
                                }))
                              }
                              maxLength={120}
                              placeholder='General location'
                              className='rounded-lg border bg-card px-3 py-2 text-sm'
                            />
                            <div className='flex gap-2'>
                              <button
                                disabled={busy}
                                className='rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground'
                              >
                                Approve and publish safe summary
                              </button>
                              <button
                                type='button'
                                disabled={busy}
                                onClick={() => void doItemReview(row, 'rejected')}
                                className='rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive'
                              >
                                Reject item
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : null}
                      {row.status === 'matched' && row.review_status === 'approved' ? (
                        <form
                          onSubmit={(event) => void doHandover(event, row)}
                          className='mt-5 grid gap-2 rounded-lg border border-border p-4 sm:grid-cols-2'
                        >
                          <div className='sm:col-span-2'>
                            <b className='text-sm'>Record a verified return</b>
                            <p className='mt-1 text-xs text-muted-foreground'>
                              A claim must be approved and independently verified before handover.
                            </p>
                          </div>
                          <select
                            name='claim_id'
                            required
                            defaultValue=''
                            className='rounded-lg border bg-card px-3 py-2 text-sm'
                          >
                            <option value='' disabled>
                              Choose verified claim
                            </option>
                            {eligibleClaims.map((claim) => (
                              <option key={claim.id} value={claim.id}>
                                Claim {claim.id.slice(0, 8)} · {claim.verification_method}
                              </option>
                            ))}
                          </select>
                          <input
                            name='handover_at'
                            type='datetime-local'
                            required
                            className='rounded-lg border bg-card px-3 py-2 text-sm'
                          />
                          <input
                            name='recipient'
                            placeholder='Recipient name or reference (optional)'
                            className='rounded-lg border bg-card px-3 py-2 text-sm'
                          />
                          <input
                            name='details'
                            placeholder='Handover note (optional)'
                            className='rounded-lg border bg-card px-3 py-2 text-sm'
                          />
                          <button
                            disabled={busy || eligibleClaims.length === 0}
                            className='rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2'
                          >
                            Record handover
                          </button>
                          {eligibleClaims.length === 0 ? (
                            <p className='text-xs text-muted-foreground sm:col-span-2'>
                              No verified approved claim is available for this case.
                            </p>
                          ) : null}
                        </form>
                      ) : null}
                    </article>
                  );
                })
              )}
            </section>
          ) : (
            <section className='mt-7 space-y-3'>
              {claimRows.length === 0 ? (
                <Empty>There are no claim records available in this authorized queue.</Empty>
              ) : (
                claimRows.map((row) => (
                  <article key={row.id} className='rounded-lg border bg-card p-5'>
                    <div className='flex flex-wrap justify-between gap-4'>
                      <div>
                        <p className='font-mono text-[10px] text-muted-foreground'>
                          CLAIM {row.id.slice(0, 8)} · ITEM {row.item_id.slice(0, 8)}
                        </p>
                        <h2 className='mt-1 text-base font-semibold'>
                          Claim from account {row.claimant_id.slice(0, 8)}
                        </h2>
                        <p className='mt-2 max-w-3xl text-sm leading-6 text-muted-foreground'>
                          {row.statement}
                        </p>
                        <p className='mt-2 text-xs text-muted-foreground'>
                          Submitted {new Date(row.created_at).toLocaleDateString()}{' '}
                          {row.verification_method
                            ? `· verified by ${row.verification_method}`
                            : ''}
                        </p>
                      </div>
                      <span className='h-fit rounded-full bg-muted px-3 py-1.5 text-xs font-semibold'>
                        {row.status.replace('_', ' ')}
                      </span>
                    </div>
                    {row.status === 'pending' || row.status === 'needs_information' ? (
                      <div className='mt-4 flex flex-wrap gap-2'>
                        <button
                          disabled={busy}
                          onClick={() => void doReview(row, 'approved')}
                          className='rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50'
                        >
                          Approve claim
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void doReview(row, 'needs_information')}
                          className='rounded-lg border px-3 py-2 text-xs font-medium disabled:opacity-50'
                        >
                          Request information
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => void doReview(row, 'rejected')}
                          className='rounded-lg border border-destructive/40 px-3 py-2 text-xs font-medium text-destructive disabled:opacity-50'
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                    {row.status === 'approved' && !row.verified_at ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void doVerify(row);
                        }}
                        className='mt-4 grid gap-2 rounded-xl bg-muted p-4 sm:grid-cols-[200px_1fr_auto]'
                      >
                        <label className='sr-only' htmlFor={`method-${row.id}`}>
                          Verification method
                        </label>
                        <select
                          id={`method-${row.id}`}
                          value={verification[row.id]?.method ?? 'in_person'}
                          onChange={(e) =>
                            setVerification((all) => ({
                              ...all,
                              [row.id]: { method: e.target.value, note: all[row.id]?.note ?? '' }
                            }))
                          }
                          className='rounded-lg border bg-card px-3 py-2 text-sm'
                        >
                          <option value='in_person'>In person</option>
                          <option value='video_call'>Video call</option>
                          <option value='document_review'>Document review</option>
                          <option value='other'>Other method</option>
                        </select>
                        <textarea
                          required
                          minLength={8}
                          maxLength={2000}
                          rows={2}
                          value={verification[row.id]?.note ?? ''}
                          onChange={(e) =>
                            setVerification((all) => ({
                              ...all,
                              [row.id]: {
                                method: all[row.id]?.method ?? 'in_person',
                                note: e.target.value
                              }
                            }))
                          }
                          placeholder='Describe what you checked (8–2000 characters)'
                          className='rounded-lg border bg-card px-3 py-2 text-sm'
                        />
                        <button
                          disabled={busy}
                          className='rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground'
                        >
                          Record verification
                        </button>
                      </form>
                    ) : null}
                  </article>
                ))
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className='rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground'>
      {children}
    </div>
  );
}
