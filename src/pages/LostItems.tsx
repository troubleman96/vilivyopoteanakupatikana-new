import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LostFoundItem } from '@/types';
import { ItemsTable } from '@/components/items/ItemsTable';
import { ItemDetailsDialog } from '@/components/items/ItemDetailsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Filter, AlertTriangle, Download, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function LostItems() {
  const { user } = useAuth();
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data, isLoading, error } = useQuery({
    queryKey: ['lost-items', statusFilter, categoryFilter, searchQuery],
    queryFn: async () => {
      const params: any = { item_type: 'lost' };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (categoryFilter !== 'all') params.category = categoryFilter;
      if (searchQuery) params.search = searchQuery;

      const response = await api.get('/items/', { params });
      return response.data.data?.results || [];
    },
  });

  const items = data || [];
  const categories = [...new Set(items.filter((i: any) => i && i.category).map((item: LostFoundItem) => item.category))];

  const handleViewDetails = (item: LostFoundItem) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleMatch = (item: LostFoundItem) => {
    console.log('Match item:', item);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <AlertTriangle className="h-7 w-7 text-warning" />
            Lost Items
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === 'super_admin'
              ? 'Manage lost items across all universities'
              : 'View and manage lost item reports'}
          </p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="potential_match">Potential Match</SelectItem>
              <SelectItem value="claimed">Claimed</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat: any) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: items.length, color: 'text-foreground' },
          { label: 'Open', value: items.filter((i: any) => i.status === 'open' || i.status === 'pending').length, color: 'text-warning' },
          { label: 'Matched', value: items.filter((i: any) => i.status === 'matched' || i.status === 'potential_match').length, color: 'text-info' },
          { label: 'Returned', value: items.filter((i: any) => i.status === 'returned').length, color: 'text-success' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-lg bg-card border border-border/50">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-bold font-display ${stat.color}`}>{isLoading ? '...' : stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading items...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-destructive">Error loading items</h3>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      ) : (
        <>
          <ItemsTable
            items={items}
            onViewDetails={handleViewDetails}
            onMatch={handleMatch}
            showUniversity={user?.role === 'super_admin'}
          />

          {/* Empty State */}
          {items.length === 0 && (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No items found</h3>
              <p className="text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          )}
        </>
      )}

      {/* Details Dialog */}
      <ItemDetailsDialog
        item={selectedItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onMatch={() => {
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
