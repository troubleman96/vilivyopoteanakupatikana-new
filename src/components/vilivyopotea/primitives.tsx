import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  IconBackpack,
  IconBottle,
  IconDeviceLaptop,
  IconHeadphones,
  IconKey,
  IconShieldCheck
} from '@tabler/icons-react';
import type { LostFoundItem } from '@/lib/demo-data';

export function PageHeading({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className='mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end'>
      <div>
        {eyebrow && (
          <p className='mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-primary'>
            {eyebrow}
          </p>
        )}
        <h1 className='text-2xl font-bold tracking-tight sm:text-[28px]'>{title}</h1>
        {description && (
          <p className='mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground'>
            {description}
          </p>
        )}
      </div>
      {action && <div className='shrink-0'>{action}</div>}
    </div>
  );
}

export function DemoNotice({
  children = 'Synthetic demo data only · This concept does not imply university approval.'
}: {
  children?: ReactNode;
}) {
  return (
    <div className='flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 text-xs leading-relaxed text-foreground'>
      <IconShieldCheck className='mt-0.5 size-4 shrink-0 text-primary' />
      <span>{children}</span>
    </div>
  );
}

export function StatusPill({
  children,
  tone = 'neutral'
}: {
  children: ReactNode;
  tone?: 'neutral' | 'green' | 'amber' | 'blue' | 'red';
}) {
  const style = {
    neutral: 'bg-muted text-muted-foreground',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    amber: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
    red: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
  }[tone];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${style}`}
    >
      {children}
    </span>
  );
}

export function Artwork({
  item,
  className = ''
}: {
  item: Pick<LostFoundItem, 'icon' | 'tone' | 'title'>;
  className?: string;
}) {
  const Icon = {
    laptop: IconDeviceLaptop,
    bottle: IconBottle,
    keys: IconKey,
    headphones: IconHeadphones,
    bag: IconBackpack
  }[item.icon];
  const tone = {
    mint: 'bg-[#e8f2ec] text-[#4a7867]',
    blue: 'bg-[#e5eff4] text-[#547e92]',
    sand: 'bg-[#f7efe4] text-[#a67c43]',
    lavender: 'bg-[#eeebf5] text-[#77719b]',
    peach: 'bg-[#f8ece5] text-[#a97055]'
  }[item.tone];
  return (
    <div
      role='img'
      aria-label={`Illustration for ${item.title}`}
      className={`flex items-center justify-center rounded-2xl ${tone} ${className}`}
    >
      <Icon size={38} stroke={1.45} />
    </div>
  );
}

export function ItemCard({ item }: { item: LostFoundItem }) {
  return (
    <article className='overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg'>
      <div className='p-3'>
        <Artwork item={item} className='h-36 w-full sm:h-40' />
      </div>
      <div className='px-4 pb-4'>
        <div className='flex items-center justify-between gap-2'>
          <StatusPill tone='green'>
            {item.kind} · {item.status}
          </StatusPill>
          <span className='text-[10px] text-muted-foreground'>{item.id}</span>
        </div>
        <h3 className='mt-3 text-sm font-bold'>{item.title}</h3>
        <p className='mt-1 text-[11px] text-muted-foreground'>
          {item.place.split(' · ')[0]} · {item.date}
        </p>
        <Link
          href={`/dashboard/search?item=${item.id}`}
          className='mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline'
        >
          View safe details <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

export function StatCard({
  label,
  value,
  note,
  accent = 'green'
}: {
  label: string;
  value: string;
  note: string;
  accent?: 'green' | 'blue' | 'amber' | 'rose';
}) {
  const dot = {
    green: 'bg-emerald-500',
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500'
  }[accent];
  return (
    <div className='rounded-2xl border border-border bg-card p-4 sm:p-5'>
      <div className='flex items-center gap-2 text-[11px] font-medium text-muted-foreground'>
        <span className={`size-2 rounded-full ${dot}`} />
        {label}
      </div>
      <div className='mt-3 text-[28px] font-bold tracking-tight'>{value}</div>
      <p className='mt-1 text-[10px] text-muted-foreground'>{note}</p>
    </div>
  );
}

export function ActionLink({
  href,
  children,
  variant = 'primary'
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  const style =
    variant === 'primary'
      ? 'bg-primary text-primary-foreground hover:opacity-90'
      : 'border border-border bg-card hover:bg-muted';
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-xs font-semibold transition ${style}`}
    >
      {children}
    </Link>
  );
}
