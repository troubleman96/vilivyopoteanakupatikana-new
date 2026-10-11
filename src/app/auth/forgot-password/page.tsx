import type { Metadata } from 'next';
import { EmailActionForm } from '@/components/vilivyopotea/auth-recovery';

export const metadata: Metadata = { referrer: 'no-referrer' };

export default function ForgotPasswordPage() {
  return <EmailActionForm action='reset' />;
}
