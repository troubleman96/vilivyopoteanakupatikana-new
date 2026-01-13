import { useState } from 'react';
import { universities } from '@/data/mockData';
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

export default function Universities() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUniversity, setSelectedUniversity] = useState<University | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filteredUniversities = universities.filter(
    (uni) =>
      uni.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uni.shortName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uni.emailDomain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleStatus = (uni: University) => {
    toast.success(`${uni.shortName} ${uni.isActive ? 'disabled' : 'enabled'} successfully`);
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
          <p className="text-2xl font-bold font-display">{universities.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
          <p className="text-sm text-success">Active</p>
          <p className="text-2xl font-bold font-display text-success">
            {universities.filter((u) => u.isActive).length}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-muted border border-border/50">
          <p className="text-sm text-muted-foreground">Inactive</p>
          <p className="text-2xl font-bold font-display">
            {universities.filter((u) => !u.isActive).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
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
            {filteredUniversities.map((uni) => (
              <TableRow key={uni.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                      <Building2 className="h-5 w-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-medium">{uni.shortName}</p>
                      <p className="text-sm text-muted-foreground">{uni.name}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <code className="text-sm bg-muted px-2 py-1 rounded">@{uni.emailDomain}</code>
                </TableCell>
                <TableCell className="text-muted-foreground">{uni.campuses.length}</TableCell>
                <TableCell>
                  <span className="font-medium">{uni.activeItems}</span>
                  <span className="text-muted-foreground"> / {uni.totalItems}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={uni.isActive}
                      onCheckedChange={() => handleToggleStatus(uni)}
                    />
                    <span
                      className={`text-sm ${
                        uni.isActive ? 'text-success' : 'text-muted-foreground'
                      }`}
                    >
                      {uni.isActive ? 'Active' : 'Inactive'}
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
      </div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedUniversity?.name}</DialogTitle>
            <DialogDescription>University details and configuration</DialogDescription>
          </DialogHeader>

          {selectedUniversity && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Short Name</Label>
                  <p className="font-medium">{selectedUniversity.shortName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email Domain</Label>
                  <p className="font-mono">@{selectedUniversity.emailDomain}</p>
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
                    <p className="font-medium text-sm">{selectedUniversity.contactEmail}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <Label className="text-muted-foreground">Phone</Label>
                    <p className="font-medium text-sm">{selectedUniversity.contactPhone}</p>
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Campuses</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedUniversity.campuses.map((campus) => (
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
                  <p className="text-2xl font-bold">{selectedUniversity.totalItems}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Active Items</Label>
                  <p className="text-2xl font-bold text-secondary">
                    {selectedUniversity.activeItems}
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
