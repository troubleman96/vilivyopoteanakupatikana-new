import { DocumentationShell } from '@/components/vilivyopotea/docs-site';

export default function DocumentationLayout({ children }: { children: React.ReactNode }) {
  return <DocumentationShell>{children}</DocumentationShell>;
}
