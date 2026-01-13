import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { foundItems } from '@/data/mockData';
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
import { Search, Filter, Package, Download, Plus } from 'lucide-react';

export default function FoundItems() {
  const { user } = useAuth();
  const [selectedItem, setSelectedItem] = useState<LostFoundItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Filter items based on user role
  const baseItems = user?.role === 'super_admin'
    ? foundItems
    : foundItems.filter((item) => item.universityId === user?.universityId);

  // Apply filters
  const filteredItems = baseItems.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const categories = [...new Set(baseItems.map((item) => item.category))];

  const handleViewDetails = (item: LostFoundItem) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <Package className="h-7 w-7 text-secondary" />
            Found Items
          </h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === 'super_admin'
              ? 'Manage found items across all universities'
              : 'View and manage found item reports'}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Found Item
          </Button>
        </div>
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
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="matched">Matched</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
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
          { label: 'Total', value: baseItems.length, color: 'text-foreground' },
          { label: 'Pending', value: baseItems.filter((i) => i.status === 'pending').length, color: 'text-warning' },
          { label: 'Matched', value: baseItems.filter((i) => i.status === 'matched').length, color: 'text-info' },
          { label: 'Verified', value: baseItems.filter((i) => i.status === 'verified').length, color: 'text-success' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-lg bg-card border border-border/50">
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className={`text-2xl font-bold font-display ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <ItemsTable
        items={filteredItems}
        onViewDetails={handleViewDetails}
        showUniversity={user?.role === 'super_admin'}
      />

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No items found</h3>
          <p className="text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      )}

      {/* Details Dialog */}
      <ItemDetailsDialog
        item={selectedItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
