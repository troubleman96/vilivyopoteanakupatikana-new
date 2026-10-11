import type { Metadata } from 'next';
import { VerifyEmail } from '@/components/vilivyopotea/auth-recovery';

export const metadata: Metadata = { referrer: 'no-referrer' };

type VerifyPageProps = { searchParams: Promise<{ token?: string }> };

export default async function VerifyPage({ searchParams }: VerifyPageProps) {
  const { token } = await searchParams;
  return <VerifyEmail token={token ?? ''} />;
}
