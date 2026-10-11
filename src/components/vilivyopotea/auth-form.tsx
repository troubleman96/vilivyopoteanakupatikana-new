'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isApiConfigured, registerLocalAccount, signInLocalAccount } from '@/lib/api';
import { BrandMark } from './app-shell';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up';
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!isApiConfigured()) {
      setMessage(
        'The Go API is not configured. Start the local PostgreSQL-backed application stack and try again.'
      );
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    setBusy(true);
    try {
      if (isSignUp) {
        await registerLocalAccount(email, password);
        setMessage(
          'If this address is eligible, a verification link has been added to the local mail outbox. Verify before signing in.'
        );
        return;
      }
      await signInLocalAccount(email, password);
      setMessage('Signed in. Opening your account…');
      router.push('/dashboard/account');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'The account request could not be completed.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]'>
      <section className='relative hidden flex-col justify-between overflow-hidden bg-[#102922] p-10 text-white lg:flex xl:p-14'>
        <div className='relative z-10'>
          <BrandMark />
        </div>
        <div className='relative z-10 max-w-lg'>
          <span className='rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-100'>
            Synthetic preview
          </span>
          <h1 className='mt-6 text-4xl font-bold leading-tight'>
            A safer way to find what’s lost.
          </h1>
          <p className='mt-4 max-w-md text-sm leading-7 text-white/70'>
            Public discovery, private claims and careful staff-mediated returns. This demonstration
            uses invented records only.
          </p>
          <p className='mt-6 text-xs leading-6 text-white/60'>
            Institution participation and approval are not implied. Staff—not AI—verify claims.
          </p>
        </div>
        <p className='relative z-10 text-[10px] text-white/50'>
          Free for individuals · No public contact exchange
        </p>
        <div className='pointer-events-none absolute -right-20 top-1/3 size-80 rounded-full border border-emerald-200/10' />
        <div className='pointer-events-none absolute -right-7 top-[38%] size-56 rounded-full border border-emerald-200/10' />
      </section>
      <section className='flex items-center justify-center p-5 sm:p-10'>
        <div className='w-full max-w-md'>
          <Link href='/' className='mb-8 inline-flex lg:hidden'>
            <BrandMark />
          </Link>
          <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-primary'>
            LOCAL ACCOUNT · POSTGRESQL
          </p>
          <h2 className='mt-3 text-2xl font-bold tracking-tight'>
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className='mt-2 text-xs leading-5 text-muted-foreground'>
            {isSignUp
              ? 'Create a local account to manage reports and private claims.'
              : 'Sign in to manage your reports and private claims.'}
          </p>
          {!isApiConfigured() && (
            <div className='mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'>
              <strong>Local API unavailable.</strong> Start the PostgreSQL, Go API and web services
              to use accounts.
            </div>
          )}
          <form onSubmit={handleSubmit} className='mt-6 space-y-4'>
            <label className='block text-xs font-semibold'>
              Email address
              <input
                name='email'
                type='email'
                autoComplete='email'
                required
                maxLength={254}
                placeholder='you@example.test'
                className='form-control mt-2'
              />
            </label>
            <label className='block text-xs font-semibold'>
              Password
              <input
                name='password'
                type='password'
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                minLength={12}
                maxLength={72}
                required
                placeholder='At least 12 characters'
                className='form-control mt-2'
              />
            </label>
            {isSignUp && (
              <p className='text-[10px] leading-5 text-muted-foreground'>
                Local accounts are stored in PostgreSQL. Passwords are hashed; use synthetic
                accounts for testing.
              </p>
            )}
            <button
              disabled={busy}
              className='w-full rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-60'
            >
              {busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </form>
          {!isSignUp && (
            <div className='mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs'>
              <Link
                href='/auth/forgot-password'
                className='font-semibold text-primary hover:underline'
              >
                Forgot password?
              </Link>
              <Link
                href='/auth/resend-verification'
                className='font-semibold text-primary hover:underline'
              >
                Resend verification email
              </Link>
            </div>
          )}
          {message && (
            <p
              role='status'
              className='mt-4 rounded-xl bg-secondary p-3 text-xs leading-5 text-secondary-foreground'
            >
              {message}
            </p>
          )}
          <div className='mt-5 text-center text-xs text-muted-foreground'>
            {isSignUp ? 'Already registered?' : 'New here?'}{' '}
            <Link
              href={isSignUp ? '/auth/sign-in' : '/auth/sign-up'}
              className='font-semibold text-primary hover:underline'
            >
              {isSignUp ? 'Sign in' : 'Create an account'}
            </Link>
          </div>
          <div className='mt-8 border-t border-border pt-5 text-center'>
            <Link
              href='/dashboard/overview'
              className='text-xs font-semibold text-primary hover:underline'
            >
              Continue to the demo workspace →
            </Link>
            <p className='mt-2 text-[10px] text-muted-foreground'>
              Demo roles are for UI preview only; they do not grant real access.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
