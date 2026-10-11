import type { ReactNode } from 'react';

export function DemoPreviewGate({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return children;

  return (
    <section role='status' className='rounded-2xl border border-border bg-card p-6 sm:p-8'>
      <p className='text-[10px] font-bold uppercase tracking-[0.16em] text-primary'>
        Synthetic preview disabled
      </p>
      <h1 className='mt-2 text-xl font-bold tracking-tight'>No live data is shown on this page</h1>
      <p className='mt-2 max-w-2xl text-sm leading-6 text-muted-foreground'>
        This dashboard section contains fictional sample metrics and records. It is hidden unless
        the explicit local preview option is enabled. No institution or user records are loaded
        here.
      </p>
    </section>
  );
}
