'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/icons';
import {
  admins,
  auditEvents,
  createInstitution,
  currentAccount,
  institutions,
  memberships,
  setAdmin,
  setMembership,
  stats,
  updateInstitution,
  type AuditEvent,
  type Institution,
  type Membership,
  type PlatformAdmin,
  type Stats
} from '@/lib/api';

type Section = 'overview' | 'institutions' | 'admins' | 'audit';
const nav: [Section, string, typeof Icons.dashboard][] = [
  ['overview', 'Admin overview', Icons.dashboard],
  ['institutions', 'Institutions', Icons.building],
  ['admins', 'Platform administrators', Icons.admins],
  ['audit', 'Audit log', Icons.audit]
];
const productURL = process.env.NEXT_PUBLIC_PRODUCT_APP_URL ?? 'http://localhost:3000';

export default function AdminHome() {
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
  const [account, setAccount] = useState<{ id: string; email: string } | null>(null);
  const [metrics, setMetrics] = useState<Stats | null>(null);
  const [orgs, setOrgs] = useState<Institution[]>([]);
  const [platformAdmins, setPlatformAdmins] = useState<PlatformAdmin[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selectedID, setSelectedID] = useState('');
  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [newName, setNewName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('staff');
  const [adminEmail, setAdminEmail] = useState('');
  const selected = useMemo(() => orgs.find((org) => org.id === selectedID), [orgs, selectedID]);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const who = await currentAccount();
      setAccount(who);
      const [s, i, a, e] = await Promise.all([stats(), institutions(), admins(), auditEvents()]);
      setMetrics(s);
      setOrgs(i);
      setPlatformAdmins(a);
      setEvents(e);
      setSelectedID((current) => current || i[0]?.id || '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load the admin workspace.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const loadMembers = useCallback(async (id: string) => {
    setSelectedID(id);
    try {
      setMembers(await memberships(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Membership list could not be loaded.');
    }
  }, []);
  useEffect(() => {
    if (section === 'institutions' && selectedID) void loadMembers(selectedID);
  }, [section, selectedID, loadMembers]);
  async function action(work: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await work();
      setNotice(message);
      await refresh();
      if (section === 'institutions' && selectedID) await loadMembers(selectedID);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The requested change could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  async function addInstitution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim(),
      region = newRegion.trim();
    if (!name) return;
    await action(async () => {
      await createInstitution(name, region);
      setNewName('');
      setNewRegion('');
    }, 'Institution created.');
  }
  async function saveMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedID || !memberEmail.trim()) return;
    await action(
      () => setMembership(selectedID, memberEmail, memberRole, true),
      `Access granted to ${memberEmail}.`
    );
    setMemberEmail('');
  }
  async function toggleMember(m: Membership) {
    await action(
      () => setMembership(selectedID, m.email, m.role, !m.active),
      `${m.email} access ${m.active ? 'revoked' : 'restored'}.`
    );
  }
  async function saveAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminEmail.trim()) return;
    await action(
      () => setAdmin(adminEmail, true),
      `Platform admin access granted to ${adminEmail}.`
    );
    setAdminEmail('');
  }
  async function toggleAdmin(admin: PlatformAdmin) {
    await action(
      () => setAdmin(admin.email, !admin.active),
      `${admin.email} admin access ${admin.active ? 'revoked' : 'restored'}.`
    );
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
            <span className='text-[11px] text-muted-foreground'>Platform control</span>
          </span>
        </Link>
        <div
          className={`mt-8 px-2 text-[10px] font-medium text-muted-foreground ${sidebarCollapsed ? 'lg:hidden' : ''}`}
        >
          System administration
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
            Restricted actions require a platform administrator session.
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
          <span className='text-sm font-medium'>System administration</span>
        </div>
        <div className='mx-auto w-full max-w-screen-2xl px-4 pb-8 pt-5 sm:px-6 sm:pt-7 lg:px-8'>
          <header className='flex flex-wrap items-end justify-between gap-4'>
            <div>
              <p className='text-[11px] font-semibold uppercase tracking-[.16em] text-muted-foreground'>
                RESTRICTED CONSOLE · PRE-PILOT
              </p>
              <h1 className='mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-[38px]'>
                {section === 'overview'
                  ? 'System admin overview'
                  : section === 'institutions'
                    ? 'Institution management'
                    : section === 'admins'
                      ? 'Platform administrators'
                      : 'Operational audit'}
              </h1>
              <p className='mt-2 max-w-2xl text-sm leading-6 text-muted-foreground'>
                {section === 'overview'
                  ? 'Manage platform access and institutional records from one secure workspace.'
                  : section === 'institutions'
                    ? 'Create institutions, manage their status, and assign or revoke staff access.'
                    : section === 'admins'
                      ? 'Grant and revoke platform-level administrative privileges.'
                      : 'Review recent system and institution operations.'}
              </p>
            </div>
            <button
              onClick={() => void refresh()}
              aria-label='Refresh dashboard'
              className='grid size-10 place-items-center rounded-lg border bg-card text-muted-foreground hover:text-primary'
            >
              <Icons.refresh size={17} />
            </button>
          </header>
          <div className='mt-7 flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-xs text-muted-foreground'>
            <span className='size-2 rounded-full bg-[#e0a640]' />
            <strong className='text-foreground'>Pre-pilot environment</strong>
            <span>· fictional data only · no institution approval is implied</span>
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
          {loading ? (
            <div className='mt-8 rounded-3xl border bg-card p-8 text-sm text-muted-foreground'>
              Checking administrator access and loading platform data…
            </div>
          ) : section === 'overview' ? (
            <>
              <div className='mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                {[
                  [
                    'Active institutions',
                    metrics?.institutions ?? '—',
                    'Current institution directory'
                  ],
                  ['Public listings', metrics?.public_items ?? '—', 'Approved and visible items'],
                  ['Open cases', metrics?.open_cases ?? '—', 'Across the platform'],
                  [
                    'Platform administrators',
                    platformAdmins.filter((a) => a.active).length,
                    'Active privileged accounts'
                  ]
                ].map(([title, value, note]) => (
                  <article key={String(title)} className='rounded-lg border bg-card p-5'>
                    <div className='text-sm text-muted-foreground'>{title}</div>
                    <div className='mt-5 text-3xl font-semibold'>{value}</div>
                    <p className='mt-1 text-xs text-muted-foreground'>{note}</p>
                  </article>
                ))}
              </div>
              <div className='mt-6 grid gap-4 xl:grid-cols-[1.2fr_.8fr]'>
                <section className='rounded-lg border bg-card p-5'>
                  <div className='flex items-center justify-between'>
                    <h2 className='text-base font-semibold'>Platform controls</h2>
                    <span className='text-[11px] text-muted-foreground'>API-authorized</span>
                  </div>
                  <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                    {[
                      [
                        'institutions',
                        'Manage institutions',
                        'Create, update, activate or pause an institution.'
                      ],
                      [
                        'admins',
                        'Administrator access',
                        'Assign and revoke platform administrator access.'
                      ],
                      [
                        'audit',
                        'Audit activity',
                        'Inspect recent administrative and staff actions.'
                      ],
                      [
                        'institutions',
                        'Staff memberships',
                        'Grant, adjust, or suspend institution roles.'
                      ]
                    ].map(([to, title, desc]) => (
                      <button
                        key={title}
                        onClick={() => setSection(to as Section)}
                        className='rounded-lg border p-4 text-left transition hover:border-primary'
                      >
                        <b className='text-sm'>{title}</b>
                        <p className='mt-1 text-xs leading-5 text-muted-foreground'>{desc}</p>
                      </button>
                    ))}
                  </div>
                </section>
                <section className='rounded-xl border bg-muted p-5'>
                  <div className='flex items-center gap-2 text-sm font-semibold text-foreground'>
                    <Icons.shield size={18} />
                    Access guardrails
                  </div>
                  <ul className='mt-3 space-y-2 text-xs leading-5 text-muted-foreground'>
                    <li>Every admin endpoint checks active platform-admin identity.</li>
                    <li>Admin changes are recorded in the protected audit log.</li>
                    <li>The final active platform administrator cannot be removed.</li>
                    <li>Account invitations are not enabled; people must register first.</li>
                  </ul>
                </section>
              </div>
              <section className='mt-6 rounded-lg border bg-card p-5'>
                <div className='flex items-center justify-between'>
                  <h2 className='text-base font-semibold'>Recent activity</h2>
                  <button
                    onClick={() => setSection('audit')}
                    className='text-xs font-semibold text-primary'
                  >
                    View audit log <Icons.arrow className='ml-1 inline' size={14} />
                  </button>
                </div>
                <div className='mt-3 divide-y'>
                  {events.slice(0, 5).map((event) => (
                    <EventRow key={`${event.target_type}-${event.id}`} event={event} />
                  ))}
                </div>
              </section>
            </>
          ) : section === 'institutions' ? (
            <div className='mt-7 grid gap-5 xl:grid-cols-[minmax(320px,.85fr)_minmax(500px,1.5fr)]'>
              <section className='rounded-lg border bg-card p-5'>
                <h2 className='text-base font-semibold'>Institution directory</h2>
                <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                  Select an institution to manage status and access.
                </p>
                <div className='mt-4 space-y-2'>
                  {orgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => void loadMembers(org.id)}
                      className={`w-full rounded-lg border p-3 text-left ${selectedID === org.id ? 'border-primary bg-primary/10' : ''}`}
                    >
                      <span className='flex items-center justify-between gap-2'>
                        <b className='truncate text-sm'>{org.name}</b>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] ${org.active ? 'bg-primary/10 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                        >
                          {org.active ? 'Active' : 'Paused'}
                        </span>
                      </span>
                      <span className='mt-1 block text-xs text-muted-foreground'>
                        {org.region || 'Region not set'} · {org.members} staff · {org.open_cases}{' '}
                        open cases
                      </span>
                    </button>
                  ))}
                </div>
                <form onSubmit={(e) => void addInstitution(e)} className='mt-5 border-t pt-5'>
                  <h3 className='text-sm font-semibold'>Create institution</h3>
                  <div className='mt-3 grid gap-2'>
                    <input
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={180}
                      placeholder='Institution name'
                      className='rounded-lg border px-3 py-2.5 text-sm'
                    />
                    <input
                      value={newRegion}
                      onChange={(e) => setNewRegion(e.target.value)}
                      maxLength={160}
                      placeholder='Region (optional)'
                      className='rounded-lg border px-3 py-2.5 text-sm'
                    />
                    <button
                      disabled={busy}
                      className='flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50'
                    >
                      <Icons.plus size={16} />
                      Create institution
                    </button>
                  </div>
                </form>
              </section>
              <section className='rounded-lg border bg-card p-5'>
                {selected ? (
                  <>
                    <div className='flex flex-wrap items-start justify-between gap-3'>
                      <div>
                        <p className='text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground'>
                          SELECTED INSTITUTION
                        </p>
                        <h2 className='mt-1 text-xl font-semibold'>{selected.name}</h2>
                        <p className='mt-1 text-sm text-muted-foreground'>
                          {selected.region || 'Region not set'}
                        </p>
                      </div>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void action(
                            () => updateInstitution(selected.id, { active: !selected.active }),
                            `Institution ${selected.active ? 'paused' : 'activated'}.`
                          )
                        }
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold ${selected.active ? 'text-destructive' : 'text-primary-foreground'}`}
                      >
                        {selected.active ? 'Pause institution' : 'Activate institution'}
                      </button>
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = new FormData(e.currentTarget);
                        void action(
                          () =>
                            updateInstitution(selected.id, {
                              name: String(form.get('name')).trim(),
                              region: String(form.get('region')).trim()
                            }),
                          'Institution details updated.'
                        );
                      }}
                      className='mt-5 grid gap-2 sm:grid-cols-[1fr_1fr_auto]'
                    >
                      <input
                        key={`${selected.id}-name`}
                        name='name'
                        defaultValue={selected.name}
                        maxLength={180}
                        required
                        aria-label='Institution name'
                        className='rounded-lg border px-3 py-2.5 text-sm'
                      />
                      <input
                        key={`${selected.id}-region`}
                        name='region'
                        defaultValue={selected.region}
                        maxLength={160}
                        aria-label='Region'
                        placeholder='Region'
                        className='rounded-lg border px-3 py-2.5 text-sm'
                      />
                      <button
                        disabled={busy}
                        className='rounded-lg border px-4 py-2.5 text-sm font-semibold'
                      >
                        Save
                      </button>
                    </form>
                    <div className='mt-7 border-t pt-5'>
                      <h3 className='text-sm font-semibold'>
                        Staff access{' '}
                        <span className='font-normal text-muted-foreground'>
                          · registered accounts only
                        </span>
                      </h3>
                      <form
                        onSubmit={(e) => void saveMember(e)}
                        className='mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]'
                      >
                        <input
                          required
                          type='email'
                          value={memberEmail}
                          onChange={(e) => setMemberEmail(e.target.value)}
                          placeholder='Account email address'
                          className='rounded-lg border px-3 py-2.5 text-sm'
                        />
                        <select
                          value={memberRole}
                          onChange={(e) => setMemberRole(e.target.value)}
                          className='rounded-lg border bg-card px-3 py-2.5 text-sm'
                        >
                          <option value='staff'>Staff</option>
                          <option value='institution_admin'>Institution admin</option>
                        </select>
                        <button
                          disabled={busy}
                          className='rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground'
                        >
                          Grant access
                        </button>
                      </form>
                      <div className='mt-4 overflow-x-auto'>
                        <table className='w-full min-w-[460px] text-left text-sm'>
                          <thead className='text-[10px] uppercase tracking-wider text-muted-foreground'>
                            <tr>
                              <th className='py-2 font-semibold'>Account</th>
                              <th className='py-2 font-semibold'>Role</th>
                              <th className='py-2 font-semibold'>Status</th>
                              <th className='py-2' />
                            </tr>
                          </thead>
                          <tbody className='divide-y'>
                            {members.map((m) => (
                              <tr key={m.user_id}>
                                <td className='py-3'>{m.email}</td>
                                <td className='py-3'>{m.role.replace('_', ' ')}</td>
                                <td className='py-3'>{m.active ? 'Active' : 'Suspended'}</td>
                                <td className='py-3 text-right'>
                                  <button
                                    disabled={busy}
                                    onClick={() => void toggleMember(m)}
                                    className='text-xs font-semibold text-destructive'
                                  >
                                    {m.active ? 'Revoke' : 'Restore'}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {members.length === 0 ? (
                          <p className='py-5 text-center text-xs text-muted-foreground'>
                            No staff members assigned.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className='grid min-h-64 place-items-center text-sm text-muted-foreground'>
                    Choose an institution from the list.
                  </div>
                )}
              </section>
            </div>
          ) : section === 'admins' ? (
            <section className='mt-7 max-w-4xl rounded-lg border bg-card p-5'>
              <div className='flex items-center justify-between'>
                <div>
                  <h2 className='text-base font-semibold'>Platform administrator access</h2>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Only active registered accounts can be assigned.
                  </p>
                </div>
                <span className='rounded-full bg-muted px-3 py-1.5 text-xs'>
                  {platformAdmins.filter((a) => a.active).length} active
                </span>
              </div>
              <form
                onSubmit={(e) => void saveAdmin(e)}
                className='mt-5 flex flex-col gap-2 sm:flex-row'
              >
                <input
                  type='email'
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder='Registered account email'
                  className='min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-sm'
                />
                <button
                  disabled={busy}
                  className='rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground'
                >
                  Grant administrator access
                </button>
              </form>
              <div className='mt-5 divide-y'>
                {platformAdmins.map((admin) => (
                  <div
                    key={admin.user_id}
                    className='flex flex-wrap items-center justify-between gap-3 py-4'
                  >
                    <div className='flex items-center gap-3'>
                      <span className='grid size-9 place-items-center rounded-xl bg-muted text-foreground'>
                        <Icons.admins size={17} />
                      </span>
                      <div>
                        <b className='block text-sm'>{admin.email}</b>
                        <span className='text-xs text-muted-foreground'>
                          {admin.active ? 'Active administrator' : 'Access suspended'}
                        </span>
                      </div>
                    </div>
                    <button
                      disabled={busy}
                      onClick={() => void toggleAdmin(admin)}
                      className='text-xs font-semibold text-destructive disabled:opacity-50'
                    >
                      {admin.active ? 'Revoke access' : 'Restore access'}
                    </button>
                  </div>
                ))}
              </div>
              <p className='mt-4 rounded-xl bg-muted p-3 text-xs leading-5 text-muted-foreground'>
                The API prevents removing the final active administrator. Accounts need to register
                and verify their email before you can grant access.
              </p>
            </section>
          ) : (
            <section className='mt-7 rounded-lg border bg-card p-5'>
              <div className='flex items-center justify-between'>
                <div>
                  <h2 className='text-base font-semibold'>
                    Recent platform and institution actions
                  </h2>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Showing up to 100 latest events. Sensitive report and claim content is excluded.
                  </p>
                </div>
                <span className='rounded-full bg-muted px-3 py-1.5 text-xs'>
                  {events.length} events
                </span>
              </div>
              <div className='mt-4 divide-y'>
                {events.map((event) => (
                  <EventRow key={`${event.target_type}-${event.id}`} event={event} />
                ))}
              </div>
              {events.length === 0 ? (
                <p className='py-8 text-center text-sm text-muted-foreground'>
                  No audit events have been recorded.
                </p>
              ) : null}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
function EventRow({ event }: { event: AuditEvent }) {
  return (
    <div className='flex flex-wrap items-center justify-between gap-3 py-3'>
      <div className='flex min-w-0 items-center gap-3'>
        <span className='grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-foreground'>
          <Icons.activity size={16} />
        </span>
        <div className='min-w-0'>
          <b className='block truncate text-xs'>{event.action.replaceAll('.', ' · ')}</b>
          <span className='block truncate text-[11px] text-muted-foreground'>
            {event.actor_email ?? 'System'} · {event.target_type} {event.target_id.slice(0, 8)}
          </span>
        </div>
      </div>
      <time className='shrink-0 text-[11px] text-muted-foreground'>
        {new Date(event.created_at).toLocaleString()}
      </time>
    </div>
  );
}
