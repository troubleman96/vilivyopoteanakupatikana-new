import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { DEFAULT_THEME } from '@/components/themes/theme.config';
import ThemeProvider from '@/components/themes/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Outfit } from 'next/font/google';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '../styles/globals.css';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage'
});

export const metadata: Metadata = {
  title: {
    default: 'Vilivyopotea na Kupatikana',
    template: '%s · Vilivyopotea na Kupatikana'
  },
  description:
    'A pre-pilot lost-and-found concept for Tanzania. Preview safer listings, private claims and human-led returns using fictional demo data.',
  applicationName: 'Vilivyopotea na Kupatikana',
  robots: { index: false, follow: false }
};

export const viewport: Viewport = { themeColor: '#3ecf8e' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      data-theme={DEFAULT_THEME}
      className={`${outfit.variable} ${bricolage.variable}`}
    >
      <body className={cn('min-h-screen overflow-x-hidden bg-background font-sans antialiased')}>
        <NextTopLoader color='var(--primary)' showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider
            attribute='class'
            defaultTheme='system'
            storageKey='vilivyopotea-system-color-mode'
            enableSystem
            disableTransitionOnChange
            enableColorScheme
          >
            <Providers>
              <Toaster richColors position='top-right' />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
