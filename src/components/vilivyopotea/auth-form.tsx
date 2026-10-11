'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import { BrandMark } from './app-shell';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const isSignUp = mode === 'sign-up';
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const configured = isSupabaseConfigured();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!configured) {
      setMessage('Supabase is the default auth provider, but this project has not been connected yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    const result = isSignUp
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/sign-in` } })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    if (isSignUp && !result.data.session) {
      setMessage('Account request sent. Check the email settings in your Supabase project to complete confirmation.');
      return;
    }
    setMessage('Signed in. Opening the synthetic preview…');
    router.push('/dashboard/overview');
    router.refresh();
  }

  return <div className='grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]'>
    <section className='relative hidden flex-col justify-between overflow-hidden bg-[#102922] p-10 text-white lg:flex xl:p-14'>
      <Link href='/' className='relative z-10'><BrandMark /></Link>
      <div className='relative z-10 max-w-lg'><span className='rounded-full border border-white/20 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-100'>Synthetic preview</span><h1 className='mt-6 text-4xl font-bold leading-tight'>A safer way to find what’s lost.</h1><p className='mt-4 max-w-md text-sm leading-7 text-white/70'>Public discovery, private claims and careful staff-mediated returns. This demonstration uses invented records only.</p><p className='mt-6 text-xs leading-6 text-white/60'>Institution participation and approval are not implied. Staff—not AI—verify claims.</p></div>
      <p className='relative z-10 text-[10px] text-white/50'>Free for individuals · No public contact exchange</p>
      <div className='pointer-events-none absolute -right-20 top-1/3 size-80 rounded-full border border-emerald-200/10' /><div className='pointer-events-none absolute -right-7 top-[38%] size-56 rounded-full border border-emerald-200/10' />
    </section>
    <section className='flex items-center justify-center p-5 sm:p-10'><div className='w-full max-w-md'>
      <Link href='/' className='mb-8 inline-flex lg:hidden'><BrandMark /></Link>
      <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-primary'>SUPABASE AUTH · DEFAULT</p><h2 className='mt-3 text-2xl font-bold tracking-tight'>{isSignUp ? 'Create your account' : 'Welcome back'}</h2><p className='mt-2 text-xs leading-5 text-muted-foreground'>{isSignUp ? 'Use your account to follow reports and submit private claims.' : 'Sign in to manage your reports and private claims.'}</p>
      {!configured && <div className='mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'><strong>Not connected yet.</strong> Add your own Supabase project URL and anon key to <code>.env.local</code>. No credentials are bundled or invented.</div>}
      <form onSubmit={handleSubmit} className='mt-6 space-y-4'><label className='block text-xs font-semibold'>Email address<input name='email' type='email' autoComplete='email' required placeholder='you@example.com' className='form-control mt-2' /></label><label className='block text-xs font-semibold'>Password<input name='password' type='password' autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={8} required placeholder='At least 8 characters' className='form-control mt-2' /></label>{isSignUp && <p className='text-[10px] leading-5 text-muted-foreground'>Password and session handling are provided by Supabase Auth. Use synthetic accounts for testing.</p>}<button disabled={busy} className='w-full rounded-xl bg-primary px-4 py-3 text-xs font-bold text-primary-foreground disabled:opacity-60'>{busy ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}</button></form>
      {message && <p role='status' className='mt-4 rounded-xl bg-secondary p-3 text-xs leading-5 text-secondary-foreground'>{message}</p>}
      <div className='mt-5 text-center text-xs text-muted-foreground'>{isSignUp ? 'Already registered?' : 'New here?'} <Link href={isSignUp ? '/auth/sign-in' : '/auth/sign-up'} className='font-semibold text-primary hover:underline'>{isSignUp ? 'Sign in' : 'Create an account'}</Link></div>
      <div className='mt-8 border-t border-border pt-5 text-center'><Link href='/dashboard/overview' className='text-xs font-semibold text-primary hover:underline'>Continue to the demo workspace →</Link><p className='mt-2 text-[10px] text-muted-foreground'>Demo roles are for UI preview only; they do not grant real access.</p></div>
    </div></section>
  </div>;
}
