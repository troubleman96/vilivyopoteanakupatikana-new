'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { DemoNotice, PageHeading, StatusPill } from './primitives';
import {
  fetchPublicInstitutions,
  fetchStaffCases,
  getAccessToken,
  reviewStaffItem,
  suggestStaffMatches,
  type MatchSuggestionResponse,
  type PublicInstitution,
  type StaffCase
} from '@/lib/api';

type PublicDraft = { title: string; description: string; location: string };
type MatchState = { loading?: boolean; result?: MatchSuggestionResponse; error?: string };

const cardClass = 'rounded-2xl border border-border bg-card';

function sourceLabel(source: MatchSuggestionResponse['source']) {
  if (source === 'embeddinggemma') return 'EmbeddingGemma suggestions';
  if (source === 'assistive_ai') return 'Local assistive suggestions';
  return 'Text-search suggestions';
}

export function StaffCaseQueue() {
  const [institutions, setInstitutions] = useState<PublicInstitution[]>([]);
  const [institutionId, setInstitutionId] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [booting, setBooting] = useState(true);
  const [loadedInstitutionId, setLoadedInstitutionId] = useState('');
  const [cases, setCases] = useState<StaffCase[]>([]);
  const [queueError, setQueueError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, PublicDraft>>({});
  const [reviewingId, setReviewingId] = useState('');
  const [reviewMessage, setReviewMessage] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<Record<string, MatchState>>({});
  const loadingCases = Boolean(
    accessToken && institutionId && loadedInstitutionId !== institutionId && !queueError
  );

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const token = getAccessToken();
        if (!active) return;
        if (!token) {
          setAuthRequired(true);
          return;
        }
        setAccessToken(token);
        const directory = await fetchPublicInstitutions();
        if (active) {
          setInstitutions(directory);
          setInstitutionId((current) => current || directory[0]?.id || '');
        }
      } catch (error) {
        if (active)
          setQueueError(
            error instanceof Error ? error.message : 'The staff workspace could not be loaded.'
          );
      } finally {
        if (active) setBooting(false);
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accessToken || !institutionId) return;
    let active = true;
    async function loadCases() {
      try {
        const result = await fetchStaffCases(accessToken!, institutionId);
        if (active) {
          setCases(result);
          setLoadedInstitutionId(institutionId);
        }
      } catch (error) {
        if (active) {
          setCases([]);
          setQueueError(
            error instanceof Error ? error.message : 'The staff case queue could not be loaded.'
          );
        }
      }
    }
    void loadCases();
    return () => {
      active = false;
    };
  }, [accessToken, institutionId]);

  function updateDraft(itemId: string, key: keyof PublicDraft, value: string) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { title: '', description: '', location: '' }),
        [key]: value
      }
    }));
  }

  async function handleApprove(event: FormEvent<HTMLFormElement>, item: StaffCase) {
    event.preventDefault();
    const draft = drafts[item.item_id] ?? { title: '', description: '', location: '' };
    if (!draft.title.trim()) {
      setReviewMessage((current) => ({
        ...current,
        [item.item_id]: 'Add a general public title before approval.'
      }));
      return;
    }
    setReviewingId(item.item_id);
    setReviewMessage((current) => ({ ...current, [item.item_id]: '' }));
    try {
      const token = getAccessToken();
      if (!token) {
        setAuthRequired(true);
        return;
      }
      const response = await reviewStaffItem(token, institutionId, item.item_id, {
        status: 'approved',
        public_title: draft.title.trim(),
        public_description: draft.description.trim(),
        public_location: draft.location.trim()
      });
      setCases((current) =>
        current.map((row) =>
          row.item_id === item.item_id
            ? {
                ...row,
                review_status: response.review_status,
                visibility: response.visibility,
                public_title: draft.title.trim(),
                public_description: draft.description.trim(),
                public_location: draft.location.trim()
              }
            : row
        )
      );
      setReviewMessage((current) => ({
        ...current,
        [item.item_id]:
          'Public-safe summary approved. Match suggestions are now available for staff review.'
      }));
    } catch (error) {
      setReviewMessage((current) => ({
        ...current,
        [item.item_id]:
          error instanceof Error ? error.message : 'The public summary could not be approved.'
      }));
    } finally {
      setReviewingId('');
    }
  }

  async function handleSuggest(item: StaffCase) {
    setMatches((current) => ({ ...current, [item.item_id]: { loading: true } }));
    try {
      const token = getAccessToken();
      if (!token) {
        setAuthRequired(true);
        setMatches((current) => ({
          ...current,
          [item.item_id]: { error: 'Sign in again to request staff suggestions.' }
        }));
        return;
      }
      const result = await suggestStaffMatches(token, institutionId, item.item_id);
      setMatches((current) => ({ ...current, [item.item_id]: { result } }));
    } catch (error) {
      setMatches((current) => ({
        ...current,
        [item.item_id]: {
          error: error instanceof Error ? error.message : 'Suggestions are temporarily unavailable.'
        }
      }));
    }
  }

  if (booting) {
    return (
      <div className='space-y-6'>
        <PageHeading
          eyebrow='STAFF CASEWORK'
          title='Case queue'
          description='Checking sign-in and institution access…'
        />
        <div className={`${cardClass} p-6 text-sm text-muted-foreground`}>
          Loading authorized workspace.
        </div>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className='space-y-6'>
        <PageHeading
          eyebrow='STAFF CASEWORK · AUTHENTICATED'
          title='Case queue'
          description='Private case data is available only to signed-in, institution-authorized staff.'
        />
        <section className={`${cardClass} space-y-3 p-5`}>
          <p className='text-sm font-semibold'>Sign in to continue</p>
          <p className='text-xs leading-5 text-muted-foreground'>
            The demo role selector does not grant staff access. A verified account and active staff
            membership are checked by the API.
          </p>
          <Link
            href='/auth/sign-in'
            className='inline-flex rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground'
          >
            Sign in
          </Link>
        </section>
      </div>
    );
  }

  const selectedInstitution = institutions.find((institution) => institution.id === institutionId);
  const pendingReviewCount = cases.filter((item) => item.review_status !== 'approved').length;

  return (
    <div className='space-y-6'>
      <PageHeading
        eyebrow='STAFF CASEWORK · AUTHENTICATED'
        title='Case queue'
        description='Review private reports, publish only a human-redacted public summary, then request possible counterpart suggestions.'
      />
      <section className={`${cardClass} space-y-4 p-4 sm:p-5`}>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <label className='block min-w-64 flex-1 text-xs font-semibold'>
            Authorized institution
            <select
              value={institutionId}
              onChange={(event) => {
                setInstitutionId(event.target.value);
                setLoadedInstitutionId('');
                setQueueError('');
                setCases([]);
                setMatches({});
              }}
              className='form-control mt-2'
              disabled={institutions.length === 0}
            >
              <option value=''>Choose an institution</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name} · {institution.region}
                </option>
              ))}
            </select>
          </label>
          <div className='flex gap-2 text-[10px] text-muted-foreground'>
            <span className='rounded-full bg-secondary px-3 py-2'>{cases.length} cases</span>
            <span className='rounded-full bg-secondary px-3 py-2'>
              {pendingReviewCount} awaiting summary review
            </span>
          </div>
        </div>
        <p className='text-[10px] leading-5 text-muted-foreground'>
          {selectedInstitution
            ? `${selectedInstitution.name} · ${selectedInstitution.region}`
            : 'Choose an institution. Server-side membership checks control access.'}{' '}
          Matching uses only approved public summaries, never private claims, contacts, or withheld
          evidence.
        </p>
      </section>

      {queueError && (
        <p
          role='alert'
          className='rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
        >
          {queueError}
        </p>
      )}
      {loadingCases && (
        <div className={`${cardClass} p-5 text-xs text-muted-foreground`}>
          Loading institution-scoped cases…
        </div>
      )}
      {!loadingCases && !queueError && cases.length === 0 && institutionId && (
        <div className={`${cardClass} p-8 text-center`}>
          <h2 className='text-sm font-bold'>No cases in this authorized queue</h2>
          <p className='mt-1 text-xs text-muted-foreground'>
            Only records returned by the staff-authorized API are shown.
          </p>
        </div>
      )}

      <div className='space-y-4'>
        {cases.map((item) => {
          const draft = drafts[item.item_id] ?? { title: '', description: '', location: '' };
          const isPublic = item.review_status === 'approved' && item.visibility === 'public';
          const matchState = matches[item.item_id];
          return (
            <article key={item.id} className={`${cardClass} space-y-4 p-4 sm:p-5`}>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div>
                  <p className='font-mono text-[10px] text-muted-foreground'>Case {item.id}</p>
                  <h2 className='mt-1 text-sm font-bold'>
                    {item.kind === 'found' ? 'Found item' : 'Missing item'} · {item.private_title}
                  </h2>
                  <p className='mt-1 text-[10px] text-muted-foreground'>
                    {item.category} · {item.status}
                  </p>
                </div>
                <StatusPill tone={isPublic ? 'green' : 'amber'}>
                  {isPublic ? 'Reviewed public summary' : 'Private · needs review'}
                </StatusPill>
              </div>
              <section
                className='rounded-xl bg-muted/50 p-3'
                aria-label='Private report details for authorized staff'
              >
                <p className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
                  Private report details · authorized staff only
                </p>
                <p className='mt-2 whitespace-pre-wrap text-xs leading-5'>
                  {item.private_description || 'No additional description.'}
                </p>
                <p className='mt-2 text-[10px] text-muted-foreground'>
                  Approximate area: {item.private_location || 'Not provided'}
                </p>
              </section>
              {isPublic ? (
                <section className='rounded-xl border border-border p-3'>
                  <p className='text-[10px] font-semibold uppercase tracking-wide text-muted-foreground'>
                    Public-safe summary
                  </p>
                  <p className='mt-2 text-xs font-semibold'>{item.public_title}</p>
                  {item.public_description && (
                    <p className='mt-1 whitespace-pre-wrap text-xs leading-5 text-muted-foreground'>
                      {item.public_description}
                    </p>
                  )}
                  {item.public_location && (
                    <p className='mt-1 text-[10px] text-muted-foreground'>{item.public_location}</p>
                  )}
                </section>
              ) : (
                <form
                  onSubmit={(event) => void handleApprove(event, item)}
                  className='space-y-3 rounded-xl border border-border p-3'
                >
                  <div>
                    <h3 className='text-xs font-bold'>Review and redact a public-safe summary</h3>
                    <p className='mt-1 text-[10px] leading-5 text-muted-foreground'>
                      Write only general details. Do not copy contacts, serial numbers, exact
                      addresses, or distinctive clues from the private report.
                    </p>
                  </div>
                  <label className='block text-[10px] font-semibold'>
                    Public title
                    <input
                      required
                      maxLength={120}
                      value={draft.title}
                      onChange={(event) => updateDraft(item.item_id, 'title', event.target.value)}
                      className='form-control mt-1.5'
                      placeholder='General item description'
                    />
                  </label>
                  <label className='block text-[10px] font-semibold'>
                    Public description
                    <textarea
                      maxLength={2000}
                      rows={3}
                      value={draft.description}
                      onChange={(event) =>
                        updateDraft(item.item_id, 'description', event.target.value)
                      }
                      className='form-control mt-1.5 resize-y'
                      placeholder='Optional safe summary; leave identifying details private.'
                    />
                  </label>
                  <label className='block text-[10px] font-semibold'>
                    Public approximate area
                    <input
                      maxLength={120}
                      value={draft.location}
                      onChange={(event) =>
                        updateDraft(item.item_id, 'location', event.target.value)
                      }
                      className='form-control mt-1.5'
                      placeholder='General area only'
                    />
                  </label>
                  <button
                    type='submit'
                    disabled={reviewingId === item.item_id}
                    className='rounded-xl bg-primary px-3 py-2 text-[10px] font-semibold text-primary-foreground disabled:opacity-50'
                  >
                    {reviewingId === item.item_id
                      ? 'Approving…'
                      : 'Approve and publish safe summary'}
                  </button>
                  {reviewMessage[item.item_id] && (
                    <p role='status' className='text-[10px] leading-5 text-muted-foreground'>
                      {reviewMessage[item.item_id]}
                    </p>
                  )}
                </form>
              )}
              {isPublic && (
                <section className='space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3'>
                  <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                      <h3 className='text-xs font-bold'>Possible counterpart records</h3>
                      <p className='mt-1 text-[10px] text-muted-foreground'>
                        Suggestions only · staff must independently verify; never proof of
                        ownership.
                      </p>
                    </div>
                    <button
                      type='button'
                      onClick={() => void handleSuggest(item)}
                      disabled={matchState?.loading}
                      className='rounded-xl bg-primary px-3 py-2 text-[10px] font-semibold text-primary-foreground disabled:opacity-50'
                    >
                      {matchState?.loading ? 'Ranking…' : 'Find possible matches'}
                    </button>
                  </div>
                  {matchState?.error && (
                    <p
                      role='alert'
                      className='text-[10px] leading-5 text-rose-700 dark:text-rose-200'
                    >
                      {matchState.error}
                    </p>
                  )}
                  {matchState?.result && (
                    <div className='space-y-2'>
                      <p className='text-[10px] font-semibold text-muted-foreground'>
                        {sourceLabel(matchState.result.source)} ·{' '}
                        {matchState.result.suggestions.length} candidate
                        {matchState.result.suggestions.length === 1 ? '' : 's'}
                      </p>
                      {matchState.result.suggestions.length === 0 ? (
                        <p className='text-[10px] text-muted-foreground'>
                          No reviewed public counterpart was found in this institution.
                        </p>
                      ) : (
                        matchState.result.suggestions.map((suggestion) => (
                          <div
                            key={suggestion.candidate_id}
                            className='rounded-lg border border-border bg-card p-3'
                          >
                            <p className='text-xs font-semibold'>{suggestion.title}</p>
                            <p className='mt-1 text-[10px] text-muted-foreground'>
                              {suggestion.category} · rank {suggestion.rank}
                            </p>
                            {suggestion.explanations.length > 0 && (
                              <ul className='mt-2 list-disc pl-4 text-[10px] leading-5 text-muted-foreground'>
                                {suggestion.explanations.map((explanation) => (
                                  <li key={explanation}>{explanation}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))
                      )}
                      {matchState.result.notice && (
                        <p className='text-[10px] leading-5 text-muted-foreground'>
                          {matchState.result.notice}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}
            </article>
          );
        })}
      </div>
      <DemoNotice>
        Live private records are served only after API-side authentication and institution
        membership checks. Semantic ranking is limited to approved public summaries; people remain
        responsible for every review, claim, and handover.
      </DemoNotice>
    </div>
  );
}
