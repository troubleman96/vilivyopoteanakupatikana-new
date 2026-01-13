import { LostFoundItem } from '@/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { MapPin, Calendar, User, Phone, Mail, Building2, Link2, CheckCircle } from 'lucide-react';

interface ItemDetailsDialogProps {
  item: LostFoundItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMatch?: () => void;
  onVerify?: () => void;
}

export function ItemDetailsDialog({ 
  item, 
  open, 
  onOpenChange,
  onMatch,
  onVerify,
}: ItemDetailsDialogProps) {
  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-display">{item.title}</DialogTitle>
              <DialogDescription className="mt-1">
                {item.type === 'lost' ? 'Lost Item Report' : 'Found Item Report'}
              </DialogDescription>
            </div>
            <StatusBadge status={item.status} />
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Item Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Category</p>
              <p className="font-medium">{item.category}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">ID</p>
              <p className="font-mono text-sm">{item.id}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Description</p>
            <p className="text-foreground leading-relaxed">{item.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{item.location}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date Occurred</p>
                <p className="font-medium">
                  {new Date(item.dateOccurred).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Reporter Info */}
          <div className="space-y-4">
            <h4 className="font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Reporter Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <User className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{item.reporterName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Mail className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium text-sm">{item.reporterEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Phone className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{item.reporterPhone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Building2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">University</p>
                  <p className="font-medium">{item.universityName}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            {item.status === 'pending' && onMatch && (
              <Button onClick={onMatch} className="gap-2">
                <Link2 className="h-4 w-4" />
                Find Match
              </Button>
            )}
            {item.status === 'matched' && onVerify && (
              <Button onClick={onVerify} variant="secondary" className="gap-2">
                <CheckCircle className="h-4 w-4" />
                Verify & Approve
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
