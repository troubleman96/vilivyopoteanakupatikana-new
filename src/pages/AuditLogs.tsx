import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  Search,
  Download,
  Activity,
  CheckCircle,
  Link2,
  UserPlus,
  PackageCheck,
  Filter,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { AuditLog } from '@/types';

const actionIcons: Record<string, React.ReactNode> = {
  ITEM_MATCHED: <Link2 className="h-4 w-4" />,
  ITEM_VERIFIED: <CheckCircle className="h-4 w-4" />,
  ITEM_RETURNED: <PackageCheck className="h-4 w-4" />,
  USER_CREATED: <UserPlus className="h-4 w-4" />,
};

const actionColors: Record<string, string> = {
  ITEM_MATCHED: 'bg-info/10 text-info',
  ITEM_VERIFIED: 'bg-success/10 text-success',
  ITEM_RETURNED: 'bg-secondary/10 text-secondary',
  USER_CREATED: 'bg-primary/10 text-primary',
};

export default function AuditLogs() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const { data: logsData, isLoading, error } = useQuery({
    queryKey: ['audit-logs', actionFilter, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (actionFilter !== 'all') params.action = actionFilter;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/management/audit-logs/', { params });
      return response.data.data?.results || [];
    },
  });

  const logs: AuditLog[] = logsData || [];
  const uniqueActions = [...new Set(logs.map((log) => log.action))];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <FileText className="h-7 w-7 text-primary" />
            Audit Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Track all actions and changes in the system
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((action) => (
              <SelectItem key={action} value={action}>
                {action.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-card border border-border/50">
          <p className="text-sm text-muted-foreground">Total Logs</p>
          <p className="text-2xl font-bold font-display">{isLoading ? '...' : logs.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-info/10 border border-info/20">
          <p className="text-sm text-info">Matches</p>
          <p className="text-2xl font-bold font-display text-info">
            {isLoading ? '...' : logs.filter((l) => l.action === 'ITEM_MATCHED').length}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
          <p className="text-sm text-success">Verifications</p>
          <p className="text-2xl font-bold font-display text-success">
            {isLoading ? '...' : logs.filter((l) => l.action === 'ITEM_VERIFIED').length}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20">
          <p className="text-sm text-secondary">Returns</p>
          <p className="text-2xl font-bold font-display text-secondary">
            {isLoading ? '...' : logs.filter((l) => l.action === 'ITEM_RETURNED').length}
          </p>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading logs...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive">Error loading logs</h3>
            <p className="text-muted-foreground">Please try again later</p>
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="p-4 bg-card rounded-xl border border-border/50 hover:border-border transition-colors"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`p-2.5 rounded-lg ${actionColors[log.action] || 'bg-muted text-muted-foreground'
                    }`}
                >
                  {actionIcons[log.action] || <Activity className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{log.details}</p>
                      <div className="flex items-center flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">{log.user_name || log.userName}</span>
                        <span>•</span>
                        <span className="capitalize">
                          {(log.user_role || log.userRole || '').replace(/_/g, ' ')}
                        </span>
                        {user?.role === 'super_admin' && (log.university_id || log.universityId) && (
                          <>
                            <span>•</span>
                            <span>{log.university_name || 'University'}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                      <p>
                        {new Date(log.timestamp).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                      <p>
                        {new Date(log.timestamp).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {!isLoading && logs.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No logs found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
