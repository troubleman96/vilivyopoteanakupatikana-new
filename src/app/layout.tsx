import Providers from '@/components/layout/providers';
import { Toaster } from '@/components/ui/sonner';
import { DEFAULT_THEME, THEMES } from '@/components/themes/theme.config';
import ThemeProvider from '@/components/themes/theme-provider';
import { cn } from '@/lib/utils';
import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import NextTopLoader from 'nextjs-toploader';
import { NuqsAdapter } from 'nuqs/adapters/next/app';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Vilivyopotea na Kupatikana',
    template: '%s · Vilivyopotea na Kupatikana'
  },
  description: 'A careful lost-and-found service for Tanzania: public discovery, private claims and staff-mediated returns.',
  applicationName: 'Vilivyopotea na Kupatikana',
  robots: { index: false, follow: false }
};

export const viewport: Viewport = { themeColor: '#3ecf8e' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const savedTheme = cookieStore.get('active_theme')?.value;
  const theme = THEMES.some((item) => item.value === savedTheme) ? savedTheme! : DEFAULT_THEME;

  return (
    <html lang='en' suppressHydrationWarning data-theme={theme}>
      <body className={cn('min-h-screen overflow-x-hidden bg-background font-sans antialiased')}>
        <NextTopLoader color='var(--primary)' showSpinner={false} />
        <NuqsAdapter>
          <ThemeProvider attribute='class' defaultTheme='system' enableSystem disableTransitionOnChange enableColorScheme>
            <Providers activeThemeValue={theme}>
              <Toaster richColors position='top-right' />
              {children}
            </Providers>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
