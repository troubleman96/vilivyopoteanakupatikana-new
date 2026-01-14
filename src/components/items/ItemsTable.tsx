import { LostFoundItem } from '@/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Eye, Link2, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ItemsTableProps {
  items: LostFoundItem[];
  onViewDetails: (item: LostFoundItem) => void;
  onMatch?: (item: LostFoundItem) => void;
  showUniversity?: boolean;
}

export function ItemsTable({ items, onViewDetails, onMatch, showUniversity = false }: ItemsTableProps) {
  return (
    <div className="table-container">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Item</TableHead>
            <TableHead className="font-semibold">Category</TableHead>
            <TableHead className="font-semibold">Location</TableHead>
            {showUniversity && <TableHead className="font-semibold">University</TableHead>}
            <TableHead className="font-semibold">Date</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            if (!item) return null;
            return (
              <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{item.title}</span>
                    <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {item.description}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-xs font-medium">
                    {item.category}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.location || item.location_display || 'No location'}</TableCell>
                {showUniversity && (
                  <TableCell className="text-muted-foreground">{item.university_name || item.universityName || 'Unknown'}</TableCell>
                )}
                <TableCell className="text-muted-foreground">
                  {(() => {
                    const dateStr = item.date_reported || item.dateReported;
                    if (!dateStr) return 'No date';
                    const date = new Date(dateStr);
                    return isNaN(date.getTime()) ? 'Invalid date' : date.toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    });
                  })()}
                </TableCell>
                <TableCell>
                  <StatusBadge status={item.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewDetails(item)}
                      className="h-8 w-8"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {onMatch && item.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onMatch(item)}
                        className="h-8 w-8 text-secondary hover:text-secondary"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(item)}>
                          View Details
                        </DropdownMenuItem>
                        {item.status === 'pending' && onMatch && (
                          <DropdownMenuItem onClick={() => onMatch(item)}>
                            Find Match
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>Contact Reporter</DropdownMenuItem>
                        <DropdownMenuItem>Add Note</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
