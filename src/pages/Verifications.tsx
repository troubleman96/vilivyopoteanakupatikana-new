import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { lostItems, foundItems } from '@/data/mockData';
import { LostFoundItem } from '@/types';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CheckCircle,
  X,
  Eye,
  Link2,
  Clock,
  AlertTriangle,
  Package,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function Verifications() {
  const { user } = useAuth();
  const [selectedMatch, setSelectedMatch] = useState<{ lost: LostFoundItem; found: LostFoundItem } | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');

  // Get items based on user role
  const filterByRole = (items: LostFoundItem[]) =>
    user?.role === 'super_admin'
      ? items
      : items.filter((item) => item.universityId === user?.universityId);

  const pendingItems = filterByRole([...lostItems, ...foundItems]).filter(
    (item) => item.status === 'pending'
  );

  const matchedItems = filterByRole(lostItems).filter((item) => item.status === 'matched');

  const verifiedItems = filterByRole(lostItems).filter((item) => item.status === 'verified');

  const handleVerify = () => {
    toast.success('Item verified successfully!');
    setVerifyDialogOpen(false);
    setSelectedMatch(null);
    setNotes('');
  };

  const handleReject = () => {
    toast.error('Match rejected');
    setVerifyDialogOpen(false);
    setSelectedMatch(null);
    setNotes('');
  };

  const openMatchDetails = (lostItem: LostFoundItem) => {
    const matchedFound = foundItems.find((f) => f.id === lostItem.matchedItemId);
    if (matchedFound) {
      setSelectedMatch({ lost: lostItem, found: matchedFound });
      setVerifyDialogOpen(true);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
          <CheckCircle className="h-7 w-7 text-secondary" />
          Verifications
        </h1>
        <p className="text-muted-foreground mt-1">
          Review pending items and verify matched cases
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
          <div className="flex items-center gap-2 text-warning mb-2">
            <Clock className="h-5 w-5" />
            <span className="font-medium">Pending Review</span>
          </div>
          <p className="text-3xl font-bold font-display">{pendingItems.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-info/10 border border-info/20">
          <div className="flex items-center gap-2 text-info mb-2">
            <Link2 className="h-5 w-5" />
            <span className="font-medium">Awaiting Verification</span>
          </div>
          <p className="text-3xl font-bold font-display">{matchedItems.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
          <div className="flex items-center gap-2 text-success mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Verified Today</span>
          </div>
          <p className="text-3xl font-bold font-display">{verifiedItems.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="matched" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matched" className="gap-2">
            <Link2 className="h-4 w-4" />
            Matched Items ({matchedItems.length})
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-4 w-4" />
            Pending Items ({pendingItems.length})
          </TabsTrigger>
          <TabsTrigger value="verified" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Recently Verified ({verifiedItems.length})
          </TabsTrigger>
        </TabsList>

        {/* Matched Items */}
        <TabsContent value="matched" className="space-y-4">
          {matchedItems.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No matched items</h3>
              <p className="text-muted-foreground">All matches have been verified</p>
            </div>
          ) : (
            matchedItems.map((item) => {
              const matchedFound = foundItems.find((f) => f.id === item.matchedItemId);
              return (
                <div
                  key={item.id}
                  className="p-6 bg-card rounded-xl border border-border/50 hover:border-border transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Lost Item */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-warning">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-medium">Lost Item</span>
                        </div>
                        <h3 className="font-semibold">{item.title}</h3>
                        <p className="text-sm text-muted-foreground">{item.location}</p>
                        <p className="text-sm">Reporter: {item.reporterName}</p>
                      </div>

                      {/* Arrow */}
                      <div className="hidden md:flex items-center justify-center absolute left-1/2 transform -translate-x-1/2">
                        <ArrowRight className="h-6 w-6 text-secondary" />
                      </div>

                      {/* Found Item */}
                      {matchedFound && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-secondary">
                            <Package className="h-4 w-4" />
                            <span className="text-sm font-medium">Found Item</span>
                          </div>
                          <h3 className="font-semibold">{matchedFound.title}</h3>
                          <p className="text-sm text-muted-foreground">{matchedFound.location}</p>
                          <p className="text-sm">Found by: {matchedFound.reporterName}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      <StatusBadge status={item.status} />
                      <Button
                        size="sm"
                        onClick={() => openMatchDetails(item)}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        Review
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Pending Items */}
        <TabsContent value="pending" className="space-y-4">
          {pendingItems.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No pending items</h3>
              <p className="text-muted-foreground">All items have been processed</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {pendingItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-card rounded-lg border border-border/50 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`p-2 rounded-lg ${
                        item.type === 'lost' ? 'bg-warning/10' : 'bg-secondary/10'
                      }`}
                    >
                      {item.type === 'lost' ? (
                        <AlertTriangle className="h-5 w-5 text-warning" />
                      ) : (
                        <Package className="h-5 w-5 text-secondary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.type === 'lost' ? 'Lost' : 'Found'} at {item.location}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={item.status} />
                    <Button variant="outline" size="sm" className="gap-1">
                      <Link2 className="h-4 w-4" />
                      Find Match
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Verified Items */}
        <TabsContent value="verified" className="space-y-4">
          {verifiedItems.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No verified items yet</h3>
              <p className="text-muted-foreground">Verified items will appear here</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {verifiedItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-card rounded-lg border border-success/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-success/10">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">{item.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Verified by {item.verifiedBy} on{' '}
                        {new Date(item.verifiedAt!).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Verification Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Verify Match</DialogTitle>
            <DialogDescription>
              Review the match details and verify ownership before approval
            </DialogDescription>
          </DialogHeader>

          {selectedMatch && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Lost Item */}
                <div className="p-4 rounded-lg bg-warning/5 border border-warning/20">
                  <div className="flex items-center gap-2 text-warning mb-3">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-medium">Lost Item</span>
                  </div>
                  <h4 className="font-semibold">{selectedMatch.lost.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedMatch.lost.description}
                  </p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Location:</span> {selectedMatch.lost.location}</p>
                    <p><span className="text-muted-foreground">Reporter:</span> {selectedMatch.lost.reporterName}</p>
                    <p><span className="text-muted-foreground">Email:</span> {selectedMatch.lost.reporterEmail}</p>
                  </div>
                </div>

                {/* Found Item */}
                <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/20">
                  <div className="flex items-center gap-2 text-secondary mb-3">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Found Item</span>
                  </div>
                  <h4 className="font-semibold">{selectedMatch.found.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedMatch.found.description}
                  </p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Location:</span> {selectedMatch.found.location}</p>
                    <p><span className="text-muted-foreground">Found by:</span> {selectedMatch.found.reporterName}</p>
                    <p><span className="text-muted-foreground">Contact:</span> {selectedMatch.found.reporterEmail}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Verification Notes</label>
                <Textarea
                  placeholder="Add notes about the verification (e.g., proof of ownership provided, ID checked)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleReject} className="gap-2">
                  <X className="h-4 w-4" />
                  Reject Match
                </Button>
                <Button onClick={handleVerify} className="gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Verify & Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
