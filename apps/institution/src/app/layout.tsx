import type { Metadata } from 'next';
import { Bricolage_Grotesque, Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage'
});
export const metadata: Metadata = {
  title: 'Institution workspace · Vilivyopotea',
  description: 'Authenticated institution and security operations workspace.'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en' data-theme='supabase' className={`${outfit.variable} ${bricolage.variable}`}>
      <body>{children}</body>
    </html>
  );
}
