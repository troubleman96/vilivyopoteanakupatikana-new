import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/vilivyopotea/auth-recovery';

export const metadata: Metadata = { referrer: 'no-referrer' };

type ResetPasswordPageProps = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={token ?? ''} />;
}
