import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'primary' | 'secondary' | 'warning' | 'success';
  className?: string;
  isLoading?: boolean;
}

const variantStyles = {
  default: 'bg-card',
  primary: 'bg-gradient-to-br from-primary to-primary-dark text-primary-foreground',
  secondary: 'bg-gradient-to-br from-secondary to-secondary-dark text-secondary-foreground',
  warning: 'bg-gradient-to-br from-warning to-warning/80 text-warning-foreground',
  success: 'bg-gradient-to-br from-success to-success/80 text-success-foreground',
};

export function StatCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  variant = 'default',
  className,
  isLoading,
}: StatCardProps) {
  const isColored = variant !== 'default';

  return (
    <div
      className={cn(
        'stat-card animate-fade-in',
        variantStyles[variant],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2 w-full">
          <p className={cn(
            'text-sm font-medium',
            isColored ? 'text-current opacity-80' : 'text-muted-foreground'
          )}>
            {title}
          </p>
          {isLoading ? (
            <div className="h-9 w-16 bg-muted animate-pulse rounded" />
          ) : (
            <p className="text-3xl font-bold font-display tracking-tight">
              {value}
            </p>
          )}
          {description && (
            <p className={cn(
              'text-sm',
              isColored ? 'text-current opacity-70' : 'text-muted-foreground'
            )}>
              {description}
            </p>
          )}
          {trend && (
            <p className={cn(
              'text-sm font-medium',
              trend.isPositive ? 'text-success' : 'text-destructive'
            )}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}% from last week
            </p>
          )}
        </div>
        <div className={cn(
          'p-3 rounded-xl flex-shrink-0',
          isColored ? 'bg-white/20' : 'bg-primary/10'
        )}>
          <Icon className={cn(
            'h-6 w-6',
            isColored ? 'text-current' : 'text-primary'
          )} />
        </div>
      </div>
    </div>
  );
}
