import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage'
});

export const metadata: Metadata = {
  title: 'Vilivyopotea na Kupatikana | A safer way to reunite lost items',
  description:
    'A pre-pilot lost-and-found concept for Tanzania, built around safer listings, private claims and human-led returns.',
  applicationName: 'Vilivyopotea na Kupatikana'
};

export const viewport: Viewport = { themeColor: '#49cfa0' };

export default function LandingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en' className={`${outfit.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
