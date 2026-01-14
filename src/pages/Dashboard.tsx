import { useAuth } from '@/contexts/AuthContext';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  AlertTriangle,
  Package,
  Clock,
  Link2,
  CheckCircle,
  Building2,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function Dashboard() {
  const { user } = useAuth();

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/management/dashboard/stats/');
      return response.data.data;
    },
  });

  const { data: lostItemsData, isLoading: lostLoading } = useQuery({
    queryKey: ['recent-lost'],
    queryFn: async () => {
      const response = await api.get('/items/', {
        params: { item_type: 'lost', limit: 5 },
      });
      return response.data.data?.results || [];
    },
  });

  const { data: foundItemsData, isLoading: foundLoading } = useQuery({
    queryKey: ['recent-found'],
    queryFn: async () => {
      const response = await api.get('/items/', {
        params: { item_type: 'found', limit: 5 },
      });
      return response.data.data?.results || [];
    },
  });

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['recent-logs'],
    queryFn: async () => {
      const response = await api.get('/management/audit-logs/', {
        params: { limit: 5 },
      });
      return response.data.data?.results || [];
    },
  });

  const { data: universitiesData, isLoading: uniLoading } = useQuery({
    queryKey: ['universities'],
    queryFn: async () => {
      const response = await api.get('/universities/');
      return response.data.data?.results || [];
    },
    enabled: user?.role === 'super_admin',
  });

  const stats = statsData || {
    total_lost_items: 0,
    total_found_items: 0,
    pending_verifications: 0,
    matched_items: 0,
    returned_items: 0,
  };

  const recentLost = (lostItemsData || []).slice(0, 5);
  const recentFound = (foundItemsData || []).slice(0, 5);
  const recentLogs = (logsData || []).slice(0, 5);
  const unis = (universitiesData || []).slice(0, 5);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">
            {greeting()}, {user?.username || 'Admin'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === 'super_admin'
              ? 'System-wide overview of all universities'
              : `Here's what's happening at ${user?.university_name || 'your university'} today`}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" asChild>
            <Link to="/lost-items">View All Items</Link>
          </Button>
          <Button asChild>
            <Link to="/verifications">Pending Verifications</Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Lost Items"
          value={stats.total_lost_items ?? 0}
          icon={AlertTriangle}
          variant="default"
          isLoading={statsLoading}
        />
        <StatCard
          title="Found Items"
          value={stats.total_found_items ?? 0}
          icon={Package}
          variant="default"
          isLoading={statsLoading}
        />
        <StatCard
          title="Pending"
          value={stats.pending_verifications ?? 0}
          icon={Clock}
          variant="warning"
          isLoading={statsLoading}
        />
        <StatCard
          title="Matched"
          value={stats.matched_items ?? 0}
          icon={Link2}
          variant="primary"
          isLoading={statsLoading}
        />
        <StatCard
          title="Returned"
          value={stats.returned_items ?? 0}
          icon={CheckCircle}
          variant="success"
          isLoading={statsLoading}
        />
        {user?.role === 'super_admin' && (
          <StatCard
            title="Universities"
            value={unis.length}
            icon={Building2}
            variant="secondary"
            isLoading={uniLoading}
          />
        )}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Lost Items */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold font-display flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Recent Lost Items
            </h2>
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link to="/lost-items">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {lostLoading ? (
              <p className="text-sm text-muted-foreground">Loading items...</p>
            ) : recentLost.length > 0 ? (
              recentLost.map((item: any) => {
                if (!item) return null;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.location || item.location_display || 'No location'}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No recent lost items.</p>
            )}
          </div>
        </div>

        {/* Recent Found Items */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold font-display flex items-center gap-2">
              <Package className="h-5 w-5 text-secondary" />
              Recent Found Items
            </h2>
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link to="/found-items">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="space-y-3">
            {foundLoading ? (
              <p className="text-sm text-muted-foreground">Loading items...</p>
            ) : recentFound.length > 0 ? (
              recentFound.map((item: any) => {
                if (!item) return null;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.location || item.location_display || 'No location'}</p>
                    </div>
                    <StatusBadge status={item.status} />
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No recent found items.</p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Log & Universities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Log */}
        <div className="lg:col-span-2 stat-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold font-display flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </h2>
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link to="/audit-logs">
                View all <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="space-y-4">
            {logsLoading ? (
              <p className="text-sm text-muted-foreground">Loading logs...</p>
            ) : recentLogs.length > 0 ? (
              recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-4 pb-4 border-b border-border/50 last:border-0 last:pb-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.details}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{log.userName}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">
                        {(() => {
                          const dateStr = log.timestamp || log.created_at;
                          if (!dateStr) return 'Recently';
                          const date = new Date(dateStr);
                          return isNaN(date.getTime()) ? 'Recently' : date.toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No recent activity.</p>
            )}
          </div>
        </div>

        {/* Universities (Super Admin) or Quick Actions */}
        {user?.role === 'super_admin' ? (
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold font-display flex items-center gap-2">
                <Building2 className="h-5 w-5 text-secondary" />
                Universities
              </h2>
              <Button variant="ghost" size="sm" asChild className="gap-1">
                <Link to="/universities">
                  Manage <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="space-y-3">
              {uniLoading ? (
                <p className="text-sm text-muted-foreground">Loading universities...</p>
              ) : unis.length > 0 ? (
                unis.map((uni: any) => (
                  <div
                    key={uni.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{uni.short_name || uni.name}</p>
                      <p className="text-xs text-muted-foreground">{uni.active_items || 0} active items</p>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${uni.active
                        ? 'bg-success/10 text-success'
                        : 'bg-muted text-muted-foreground'
                        }`}
                    >
                      {uni.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No universities registered.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="stat-card">
            <h2 className="text-lg font-semibold font-display mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-3" asChild>
                <Link to="/verifications">
                  <Clock className="h-5 w-5" />
                  Review Pending Items
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3" asChild>
                <Link to="/lost-items">
                  <AlertTriangle className="h-5 w-5" />
                  View Lost Items
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-3" asChild>
                <Link to="/found-items">
                  <Package className="h-5 w-5" />
                  View Found Items
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
