import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nextra from 'nextra';

const withNextra = nextra({
  defaultShowCopyCode: true
});
const appRoot = path.dirname(fileURLToPath(import.meta.url));

export default withNextra({
  output: 'standalone',
  reactStrictMode: true,
  turbopack: {
    root: path.resolve(appRoot, '../..'),
    resolveAlias: {
      'next-mdx-import-source-file': './mdx-components.tsx'
    }
  }
});
