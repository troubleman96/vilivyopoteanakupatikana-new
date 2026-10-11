'use client';

import React from 'react';
import QueryProvider from '@/components/layout/query-provider';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
