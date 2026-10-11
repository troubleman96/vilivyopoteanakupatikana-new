import type { Metadata } from 'next';
import { DocumentationIndex } from '@/components/vilivyopotea/docs-site';

export const metadata: Metadata = {
  title: 'Developer documentation',
  description:
    'Architecture and developer reference for the web app, Go API, Python AI service, and FastMCP server.'
};

export default function DocumentationHomePage() {
  return <DocumentationIndex />;
}
