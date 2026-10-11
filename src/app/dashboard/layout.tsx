import { AppShell } from '@/components/vilivyopotea/app-shell';
import { DemoRoleProvider } from '@/components/vilivyopotea/role-context';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DemoRoleProvider><AppShell>{children}</AppShell></DemoRoleProvider>;
}
