'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import {
  isApiConfigured,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  verifyEmail
} from '@/lib/api';
import { BrandMark } from './app-shell';

type EmailAction = 'reset' | 'verify';

function AuthPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className='flex min-h-screen items-center justify-center p-5 sm:p-10'>
      <section className='w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8'>
        <div className='mb-7 inline-flex'>
          <BrandMark />
        </div>
        <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-primary'>
          LOCAL ACCOUNT · POSTGRESQL
        </p>
        <h1 className='mt-3 text-2xl font-bold tracking-tight'>{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function EmailActionForm({ action }: { action: EmailAction }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const isReset = action === 'reset';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!isApiConfigured()) {
      setMessage('The PostgreSQL-backed API is not configured.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    setBusy(true);
    try {
      const result = isReset
        ? await requestPasswordReset(email)
        : await requestEmailVerification(email);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The request could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPanel title={isReset ? 'Reset your password' : 'Resend verification email'}>
      <p className='mt-2 text-xs leading-5 text-muted-foreground'>
        {isReset
          ? 'Enter the email used for your local account. If it matches an active account, a one-time reset link will appear in the local mail outbox.'
          : 'Enter your account email. If it still needs verification, a fresh one-time link will appear in the local mail outbox.'}
      </p>
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
        <button
          disabled={busy}
          className='w-full rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-60'
        >
          {busy ? 'Please wait…' : isReset ? 'Request reset link' : 'Request verification link'}
        </button>
      </form>
      {message && (
        <p
          role='status'
          className='mt-4 rounded-xl bg-secondary p-3 text-xs leading-5 text-secondary-foreground'
        >
          {message}
        </p>
      )}
      <p className='mt-6 text-center text-xs text-muted-foreground'>
        <Link href='/auth/sign-in' className='font-semibold text-primary hover:underline'>
          Back to sign in
        </Link>
      </p>
    </AuthPanel>
  );
}

export function VerifyEmail({ token }: { token: string }) {
  const [message, setMessage] = useState(
    token
      ? 'Checking your verification link…'
      : 'This verification link is missing its token. Request another link.'
  );
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      return () => {
        active = false;
      };
    }
    window.history.replaceState(window.history.state, '', '/auth/verify');
    void verifyEmail(token)
      .then((result) => {
        if (active) {
          setSuccess(true);
          setMessage(result.message);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setMessage(
            error instanceof Error ? error.message : 'The verification link could not be used.'
          );
        }
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <AuthPanel title='Verify your email'>
      <p
        role='status'
        className='mt-3 rounded-xl bg-secondary p-3 text-xs leading-5 text-secondary-foreground'
      >
        {message}
      </p>
      <div className='mt-6 flex flex-wrap gap-4 text-xs'>
        {success && (
          <Link href='/auth/sign-in' className='font-semibold text-primary hover:underline'>
            Continue to sign in
          </Link>
        )}
        {!success && (
          <Link
            href='/auth/resend-verification'
            className='font-semibold text-primary hover:underline'
          >
            Request another verification link
          </Link>
        )}
      </div>
    </AuthPanel>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    if (token) {
      window.history.replaceState(window.history.state, '', '/auth/reset-password');
    }
  }, [token]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!token) {
      setMessage('This reset link is missing its token. Request a new link.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    setBusy(true);
    try {
      const result = await resetPassword(token, password);
      setComplete(true);
      setMessage(result.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The password could not be reset.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPanel title='Choose a new password'>
      <p className='mt-2 text-xs leading-5 text-muted-foreground'>
        Use at least 12 characters. This one-time link expires after one hour.
      </p>
      {!complete && (
        <form onSubmit={handleSubmit} className='mt-6 space-y-4'>
          <label className='block text-xs font-semibold'>
            New password
            <input
              name='password'
              type='password'
              autoComplete='new-password'
              minLength={12}
              maxLength={72}
              required
              className='form-control mt-2'
            />
          </label>
          <button
            disabled={busy}
            className='w-full rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-60'
          >
            {busy ? 'Please wait…' : 'Update password'}
          </button>
        </form>
      )}
      {message && (
        <p
          role='status'
          className='mt-4 rounded-xl bg-secondary p-3 text-xs leading-5 text-secondary-foreground'
        >
          {message}
        </p>
      )}
      <p className='mt-6 text-center text-xs text-muted-foreground'>
        <Link
          href={complete ? '/auth/sign-in' : '/auth/forgot-password'}
          className='font-semibold text-primary hover:underline'
        >
          {complete ? 'Continue to sign in' : 'Request a fresh reset link'}
        </Link>
      </p>
    </AuthPanel>
  );
}
