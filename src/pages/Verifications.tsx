import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LostFoundItem, MatchRequest } from '@/types';
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
  Loader2,
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export default function Verifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedMatch, setSelectedMatch] = useState<MatchRequest | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [notes, setNotes] = useState('');

  const { data: matchesData, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const response = await api.get('/management/matches/');
      return response.data.data?.results || [];
    },
  });

  const matches: MatchRequest[] = matchesData || [];

  const pendingMatches = matches.filter(m => m.status === 'pending');
  const approvedMatches = matches.filter(m => m.status === 'approved');

  const verificationMutation = useMutation({
    mutationFn: async ({ id, action, notes }: { id: string | number; action: string; notes: string }) => {
      return api.post(`/management/matches/${id}/handle_request/`, { action, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      toast.success('Action processed successfully');
      setVerifyDialogOpen(false);
      setSelectedMatch(null);
      setNotes('');
    },
    onError: () => {
      toast.error('Failed to process action');
    },
  });

  const handleAction = (action: 'approve' | 'reject') => {
    if (!selectedMatch) return;
    verificationMutation.mutate({
      id: selectedMatch.id,
      action,
      notes,
    });
  };

  const openMatchDetails = (match: MatchRequest) => {
    setSelectedMatch(match);
    setVerifyDialogOpen(true);
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
          <p className="text-3xl font-bold font-display">{isLoading ? '...' : pendingMatches.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-info/10 border border-info/20">
          <div className="flex items-center gap-2 text-info mb-2">
            <Link2 className="h-5 w-5" />
            <span className="font-medium">Recent Matches</span>
          </div>
          <p className="text-3xl font-bold font-display">{isLoading ? '...' : matches.length}</p>
        </div>
        <div className="p-4 rounded-lg bg-success/10 border border-success/20">
          <div className="flex items-center gap-2 text-success mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Verified Total</span>
          </div>
          <p className="text-3xl font-bold font-display">{isLoading ? '...' : approvedMatches.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="matched" className="space-y-4">
        <TabsList>
          <TabsTrigger value="matched" className="gap-2">
            <Link2 className="h-4 w-4" />
            Pending Verification ({pendingMatches.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            Verified History ({approvedMatches.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending Matches */}
        <TabsContent value="matched" className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Loading matches...</p>
            </div>
          ) : pendingMatches.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <Link2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No pending matches</h3>
              <p className="text-muted-foreground">All matches have been reviewed</p>
            </div>
          ) : (
            pendingMatches.map((match) => (
              <div
                key={match.id}
                className="p-6 bg-card rounded-xl border border-border/50 hover:border-border transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                    {/* Lost Item */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-warning">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Lost Item</span>
                      </div>
                      <h3 className="font-semibold">{match.lost_item?.title || 'Unknown Item'}</h3>
                      <p className="text-sm text-muted-foreground">{match.lost_item?.location}</p>
                      <p className="text-sm">Reporter: {match.lost_item?.reporter_name || match.lost_item?.reporterName}</p>
                    </div>

                    {/* Arrow */}
                    <div className="hidden md:flex items-center justify-center absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
                      <ArrowRight className="h-6 w-6 text-secondary/40" />
                    </div>

                    {/* Found Item */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-secondary">
                        <Package className="h-4 w-4" />
                        <span className="text-sm font-medium">Found Item</span>
                      </div>
                      <h3 className="font-semibold">{match.found_item?.title || 'Unknown Item'}</h3>
                      <p className="text-sm text-muted-foreground">{match.found_item?.location}</p>
                      <p className="text-sm">Found by: {match.found_item?.reporter_name || match.found_item?.reporterName}</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <StatusBadge status={match.status as any} />
                    <Button
                      size="sm"
                      onClick={() => openMatchDetails(match)}
                      className="gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      Review
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          {approvedMatches.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-lg border">
              <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold">No verified items yet</h3>
              <p className="text-muted-foreground">Recent history will appear here</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {approvedMatches.map((match) => (
                <div
                  key={match.id}
                  className="p-4 bg-card rounded-lg border border-success/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-success/10">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">Match #{match.id}</p>
                      <p className="text-sm text-muted-foreground">
                        Verified {match.reviewedAt ? `on ${new Date(match.reviewedAt).toLocaleDateString()}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right mr-4 text-sm">
                      <p className="font-medium">{match.lost_item?.title}</p>
                      <p className="text-muted-foreground">Matched with {match.found_item?.title}</p>
                    </div>
                    <StatusBadge status={match.status as any} />
                  </div>
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
                  <h4 className="font-semibold">{selectedMatch.lost_item?.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedMatch.lost_item?.description}
                  </p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Location:</span> {selectedMatch.lost_item?.location}</p>
                    <p><span className="text-muted-foreground">Reporter:</span> {selectedMatch.lost_item?.reporter_name || selectedMatch.lost_item?.reporterName}</p>
                  </div>
                </div>

                {/* Found Item */}
                <div className="p-4 rounded-lg bg-secondary/5 border border-secondary/20">
                  <div className="flex items-center gap-2 text-secondary mb-3">
                    <Package className="h-4 w-4" />
                    <span className="font-medium">Found Item</span>
                  </div>
                  <h4 className="font-semibold">{selectedMatch.found_item?.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedMatch.found_item?.description}
                  </p>
                  <div className="mt-3 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Location:</span> {selectedMatch.found_item?.location}</p>
                    <p><span className="text-muted-foreground">Found by:</span> {selectedMatch.found_item?.reporter_name || selectedMatch.found_item?.reporterName}</p>
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
                <Button
                  variant="outline"
                  onClick={() => handleAction('reject')}
                  disabled={verificationMutation.isPending}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Reject Match
                </Button>
                <Button
                  onClick={() => handleAction('approve')}
                  disabled={verificationMutation.isPending}
                  className="gap-2"
                >
                  {verificationMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
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
