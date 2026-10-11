import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocumentationArticle } from '@/components/vilivyopotea/docs-site';
import { documentationNavigation, documentationPages } from '@/lib/docs-content';

export function generateStaticParams() {
  return documentationNavigation.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = documentationPages[slug];
  return page ? { title: page.title, description: page.summary } : { title: 'Documentation' };
}

export default async function DocumentationArticlePage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!documentationPages[slug]) notFound();
  return <DocumentationArticle slug={slug} />;
}
