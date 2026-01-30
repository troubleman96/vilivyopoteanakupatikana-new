import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { User, UserRole } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users as UsersIcon,
  Plus,
  Search,
  Shield,
  Building2,
  MoreHorizontal,
  Edit,
  Trash2,
  Mail,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

const roleLabels: Record<UserRole, { label: string; className: string }> = {
  super_admin: {
    label: 'Super Admin',
    className: 'bg-primary/10 text-primary',
  },
  university_admin: {
    label: 'Uni Admin',
    className: 'bg-secondary/10 text-secondary',
  },
  security_officer: {
    label: 'Security',
    className: 'bg-info/10 text-info',
  },
};

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['users', roleFilter, searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (roleFilter !== 'all') params.role = roleFilter;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/management/users/', { params });
      return response.data.data?.results || [];
    },
  });

  const usersList = data || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <UsersIcon className="h-7 w-7 text-primary" />
            {currentUser?.role === 'super_admin' ? 'All Users' : 'Staff Management'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {currentUser?.role === 'super_admin'
              ? 'Manage users across all universities'
              : 'Manage your university staff accounts'}
          </p>
        </div>
        <Button className="gap-2" onClick={() => navigate('/users/new')}>
          <Plus className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {currentUser?.role === 'super_admin' && (
              <SelectItem value="super_admin">Super Admin</SelectItem>
            )}
            <SelectItem value="university_admin">University Admin</SelectItem>
            <SelectItem value="security_officer">Security Officer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-card border border-border/50">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="text-2xl font-bold font-display">{isLoading ? '...' : usersList.length}</p>
        </div>
        {currentUser?.role === 'super_admin' && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-sm text-primary">Super Admins</p>
            <p className="text-2xl font-bold font-display text-primary">
              {isLoading ? '...' : usersList.filter((u: any) => u.role === 'super_admin').length}
            </p>
          </div>
        )}
        <div className="p-4 rounded-lg bg-secondary/10 border border-secondary/20">
          <p className="text-sm text-secondary">Uni Admins</p>
          <p className="text-2xl font-bold font-display text-secondary">
            {isLoading ? '...' : usersList.filter((u: any) => u.role === 'university_admin').length}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-info/10 border border-info/20">
          <p className="text-sm text-info">Security Officers</p>
          <p className="text-2xl font-bold font-display text-info">
            {isLoading ? '...' : usersList.filter((u: any) => u.role === 'security_officer').length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive">Error loading users</h3>
            <p className="text-muted-foreground">Please try again later</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">User</TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                {currentUser?.role === 'super_admin' && (
                  <TableHead className="font-semibold">University</TableHead>
                )}
                <TableHead className="font-semibold">Last Login</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersList.map((user: User) => {
                const roleConfig = roleLabels[user.role];
                return (
                  <TableRow key={user.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                          <span className="text-sm font-semibold text-primary">
                            {(user.name || user.username)
                              .split(' ')
                              .map((n) => n[0])
                              .join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{user.name || user.username}</p>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleConfig?.className || 'bg-muted text-muted-foreground'}`}
                      >
                        <Shield className="h-3 w-3" />
                        {roleConfig?.label || user.role}
                      </span>
                    </TableCell>
                    {currentUser?.role === 'super_admin' && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span>{user.university_name || 'System'}</span>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">
                      {user.lastLogin
                        ? new Date(user.lastLogin).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit User
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="h-4 w-4 mr-2" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Deactivate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {!isLoading && usersList.length === 0 && (
        <div className="text-center py-12">
          <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No users found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
}
