import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Search,
  Package,
  CheckCircle,
  Building2,
  Users,
  FileText,
  Settings,
  LogOut,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const navigationItems = {
  super_admin: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Universities', href: '/universities', icon: Building2 },
    { name: 'All Lost Items', href: '/lost-items', icon: AlertTriangle },
    { name: 'All Found Items', href: '/found-items', icon: Package },
    { name: 'Verifications', href: '/verifications', icon: CheckCircle },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Audit Logs', href: '/audit-logs', icon: FileText },
    { name: 'Settings', href: '/settings', icon: Settings },
  ],
  university_admin: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Lost Items', href: '/lost-items', icon: AlertTriangle },
    { name: 'Found Items', href: '/found-items', icon: Package },
    { name: 'Verifications', href: '/verifications', icon: CheckCircle },
    { name: 'Staff', href: '/users', icon: Users },
    { name: 'Audit Logs', href: '/audit-logs', icon: FileText },
  ],
  security_officer: [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Lost Items', href: '/lost-items', icon: AlertTriangle },
    { name: 'Found Items', href: '/found-items', icon: Package },
    { name: 'Verifications', href: '/verifications', icon: CheckCircle },
  ],
};

interface SidebarProps {
  className?: string;
  onLinkClick?: () => void;
}

export function Sidebar({ className, onLinkClick }: SidebarProps) {
  const location = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const navItems = navigationItems[user.role];

  const getRoleBadge = () => {
    switch (user.role) {
      case 'super_admin':
        return { label: 'Super Admin', className: 'bg-primary/20 text-primary' };
      case 'university_admin':
        return { label: 'Uni Admin', className: 'bg-secondary/20 text-secondary' };
      case 'security_officer':
        return { label: 'Security', className: 'bg-info/20 text-info' };
    }
  };

  const badge = getRoleBadge();

  return (
    <div className={cn("flex h-full w-full flex-col bg-sidebar text-sidebar-foreground", className)}>
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-6 border-b border-sidebar-border">
        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-sidebar-border bg-white shadow-sm">
          <img
            src="/vilivyopoteanakupatikana_favicon/favicon-96x96.png"
            alt="Logo"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-sm">TZ UniFind</span>
          <span className="text-xs text-sidebar-foreground/60">Control Panel</span>
        </div>
      </div>

      {/* User Info */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent">
            <span className="text-sm font-semibold">
              {user.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <span className={cn(
              'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
              badge.className
            )}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  to={item.href}
                  onClick={onLinkClick}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
