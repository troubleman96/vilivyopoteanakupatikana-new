import { useState } from 'react';
import { University } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Mail,
  Phone,
  MoreHorizontal,
  Edit,
  Trash2,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

export default function Universities() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['universities', searchQuery],
    queryFn: async () => {
      const params: any = {};
      if (searchQuery) params.search = searchQuery;
      const response = await api.get('/universities/', { params });
      return response.data.data?.results || [];
    },
  });

  const universitiesList = data || [];

  const handleToggleStatus = async (uni: University) => {
    try {
      const newStatus = !(uni.is_active || uni.isActive);
      const response = await api.patch(`/management/universities/${uni.id}/`, {
        is_active: newStatus,
      });
      if (response.data.success) {
        toast.success(`${uni.short_name || uni.shortName} ${newStatus ? 'enabled' : 'disabled'} successfully`);
      }
    } catch (error) {
      toast.error('Failed to update university status');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <Building2 className="h-7 w-7 text-secondary" />
            Universities
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage registered universities and their access
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add University
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search universities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-card border border-border/50">
          <p className="text-sm text-muted-foreground">Total Universities</p>
          <p className="text-2xl font-bold font-display">{isLoading ? '...' : universitiesList.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
          <p className="text-sm text-success">Active</p>
          <p className="text-2xl font-bold font-display text-success">
            {isLoading ? '...' : universitiesList.filter((u: any) => u.is_active || u.isActive).length}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted border border-border/50">
          <p className="text-sm text-muted-foreground">Inactive</p>
          <p className="text-2xl font-bold font-display">
            {isLoading ? '...' : universitiesList.filter((u: any) => !(u.is_active || u.isActive)).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-secondary" />
            <p className="text-muted-foreground">Loading universities...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-destructive">Error loading universities</h3>
            <p className="text-muted-foreground">Please try again later</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">University</TableHead>
                <TableHead className="font-semibold">Email Domain</TableHead>
                <TableHead className="font-semibold">Campuses</TableHead>
                <TableHead className="font-semibold">Active Items</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {universitiesList.map((uni: University) => (
                <TableRow key={uni.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                        <Building2 className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <p className="font-medium">{uni.short_name || uni.shortName}</p>
                        <p className="text-sm text-muted-foreground">{uni.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">@{uni.email_domain || uni.emailDomain}</code>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{uni.campuses?.length || 0}</TableCell>
                  <TableCell>
                    <span className="font-medium">{uni.active_items || uni.activeItems || 0}</span>
                    <span className="text-muted-foreground"> / {uni.total_items || uni.totalItems || 0}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={uni.is_active || uni.isActive}
                        onCheckedChange={() => handleToggleStatus(uni)}
                      />
                      <span
                        className={`text-sm ${(uni.is_active || uni.isActive) ? 'text-success' : 'text-muted-foreground'
                          }`}
                      >
                        {(uni.is_active || uni.isActive) ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedUniversity(uni);
                            setDetailsOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-width-lg">
          <DialogHeader>
            <DialogTitle>{selectedUniversity?.name}</DialogTitle>
            <DialogDescription>University details and configuration</DialogDescription>
          </DialogHeader>

          {selectedUniversity && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Short Name</Label>
                  <p className="font-medium">{selectedUniversity.short_name || selectedUniversity.shortName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email Domain</Label>
                  <p className="font-mono">@{selectedUniversity.email_domain || selectedUniversity.emailDomain}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <Label className="text-muted-foreground">Address</Label>
                  <p className="font-medium">{selectedUniversity.address}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-muted-foreground">Contact Email</Label>
                    <p className="font-medium text-sm">{selectedUniversity.contact_email || selectedUniversity.contactEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium text-sm">{selectedUniversity.contact_phone || selectedUniversity.contactPhone}</p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Campuses</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUniversity.campuses?.map((campus) => (
                    <span
                      key={campus}
                      className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-sm font-medium"
                    >
                      {campus}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-muted-foreground">Total Items</Label>
                  <p className="text-2xl font-bold">{selectedUniversity.total_items || selectedUniversity.totalItems || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Active Items</Label>
                  <p className="text-2xl font-bold text-secondary">
                    {selectedUniversity.active_items || selectedUniversity.activeItems || 0}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
