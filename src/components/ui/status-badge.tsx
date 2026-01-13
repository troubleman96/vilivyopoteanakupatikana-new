import { cn } from '@/lib/utils';
import { ItemStatus } from '@/types';

interface StatusBadgeProps {
  status: ItemStatus;
  className?: string;
}

const statusConfig: Record<ItemStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  matched: {
    label: 'Matched',
    className: 'bg-info/10 text-info border-info/20',
  },
  verified: {
    label: 'Verified',
    className: 'bg-secondary/10 text-secondary border-secondary/20',
  },
  returned: {
    label: 'Returned',
    className: 'bg-success/10 text-success border-success/20',
  },
  archived: {
    label: 'Archived',
    className: 'bg-muted text-muted-foreground border-muted-foreground/20',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
