import { Footer, Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import { Bricolage_Grotesque, Outfit } from 'next/font/google';
import 'nextra-theme-docs/style.css';
import './styles.css';

const outfit = Outfit({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-outfit'
});

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage'
});

export const metadata = {
  title: {
    default: 'VPK Developer Docs',
    template: '%s | VPK Developer Docs'
  },
  description:
    'Architecture, API, service, workflow, and integration documentation for Vilivyopotea na Kupatikana.'
};

const navbar = (
  <Navbar
    logo={
      <span className='brand-lockup'>
        <span className='brand-mark'>V</span>
        <span>
          Vilivyopotea <span className='brand-muted'>Developers</span>
        </span>
      </span>
    }
    projectLink='https://github.com/troubleman96/vilivyopoteanakupatikana-new'
  />
);

const footer = (
  <Footer>VPK developer documentation · Fictional examples · Pre-pilot concept</Footer>
);

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='en' dir='ltr' suppressHydrationWarning>
      <Head />
      <body className={`${outfit.variable} ${bricolage.variable}`}>
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={await getPageMap()}
          docsRepositoryBase='https://github.com/troubleman96/vilivyopoteanakupatikana-new/tree/main/apps/docs-site'
          nextThemes={{ defaultTheme: 'light', storageKey: 'vpk-docs-theme' }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
