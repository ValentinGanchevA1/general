// apps/admin/src/features/verification/components/VerificationDetailModal.tsx
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  ScanFace,
  Expand,
  ImageOff,
} from 'lucide-react';

import type { AdminVerificationDetailDto } from '@g88/shared';
import { adminApi } from '../api';

interface VerificationDetailModalProps {
  verification: AdminVerificationDetailDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDecisionMade?: () => void;
}

function matchBadgeClass(similarity: number | null): string {
  if (similarity === null) return 'bg-muted text-muted-foreground';
  if (similarity >= 90) return 'bg-green-100 text-green-800 border-green-200';
  if (similarity >= 70) return 'bg-amber-100 text-amber-900 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function DocImage({
  src,
  alt,
  onExpand,
}: {
  src: string;
  alt: string;
  onExpand: () => void;
}) {
  const [failed, setFailed] = React.useState(false);

  return (
    <div className="relative group rounded-lg overflow-hidden border bg-black aspect-[4/3]">
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 text-sm">
          <ImageOff className="w-8 h-8" />
          Image failed to load
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
      {!failed && (
        <button
          type="button"
          onClick={onExpand}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-black/70 text-white p-1.5 hover:bg-black/90"
          title="Open full size"
        >
          <Expand className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function VerificationDetailModal({
  verification,
  open,
  onOpenChange,
  onDecisionMade,
}: VerificationDetailModalProps) {
  const [decision, setDecision] = React.useState<'approved' | 'rejected' | null>(null);
  const [reason, setReason] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [lightbox, setLightbox] = React.useState<string | null>(null);

  // Reset form whenever a different submission is opened
  React.useEffect(() => {
    setDecision(null);
    setReason('');
    setLightbox(null);
  }, [verification?.id]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setDecision(null);
      setReason('');
      setLightbox(null);
    }
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!verification || !decision) return;

    setIsSubmitting(true);
    try {
      await adminApi.decide(verification.userId, {
        decision,
        reason: reason.trim() || undefined,
      });

      toast.success(
        decision === 'approved' ? 'Verification approved' : 'Verification rejected',
      );

      onDecisionMade?.();
      handleOpenChange(false);
    } catch {
      toast.error('Failed to process decision');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!verification) return null;

  const similarity =
    verification.faceSimilarity !== null && verification.faceSimilarity !== undefined
      ? Math.round(verification.faceSimilarity * 10) / 10
      : null;

  const waitMs = Date.now() - new Date(verification.submittedAt).getTime();
  const waitLabel =
    waitMs < 60_000
      ? 'just now'
      : waitMs < 3_600_000
        ? `${Math.floor(waitMs / 60_000)}m in queue`
        : `${Math.floor(waitMs / 3_600_000)}h in queue`;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-3 flex-wrap text-left">
              <span>Review ID verification</span>
              {verification.rekognitionStatus === 'ok' && similarity !== null && (
                <Badge className={`border ${matchBadgeClass(similarity)}`}>
                  <ScanFace className="w-3.5 h-3.5 mr-1 inline" />
                  Match {similarity}%
                </Badge>
              )}
              {(verification.rekognitionStatus === 'no_face_selfie' ||
                verification.rekognitionStatus === 'no_face_id') && (
                <Badge className="border bg-amber-100 text-amber-900 border-amber-200">
                  Face issue
                </Badge>
              )}
            </DialogTitle>
            <p className="text-sm text-muted-foreground font-normal">
              Compare selfie ↔ ID photo. Approve only if the same person and the document looks genuine.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="grid lg:grid-cols-[1fr_320px] gap-0">
              {/* Comparison — primary task */}
              <div className="p-4 sm:p-6 space-y-4 bg-muted/20">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
                      Selfie
                    </Label>
                    <DocImage
                      src={verification.selfieUrl}
                      alt="Selfie"
                      onExpand={() => setLightbox(verification.selfieUrl)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
                      ID front
                    </Label>
                    <DocImage
                      src={verification.idFrontUrl}
                      alt="ID front"
                      onExpand={() => setLightbox(verification.idFrontUrl)}
                    />
                  </div>
                </div>

                {verification.idBackUrl && (
                  <div className="max-w-md">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
                      ID back (optional)
                    </Label>
                    <DocImage
                      src={verification.idBackUrl}
                      alt="ID back"
                      onExpand={() => setLightbox(verification.idBackUrl!)}
                    />
                  </div>
                )}
              </div>

              {/* Decision rail */}
              <div className="border-t lg:border-t-0 lg:border-l flex flex-col bg-background">
                <ScrollArea className="flex-1 max-h-[50vh] lg:max-h-none">
                  <div className="p-4 sm:p-5 space-y-5">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <code className="font-mono text-xs break-all">{verification.userId}</code>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>
                          {new Date(verification.submittedAt).toLocaleString()} · {waitLabel}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2 rounded-lg border p-3 bg-muted/40">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <ScanFace className="w-4 h-4" />
                        Face assist
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Assist only — not proof of document authenticity. You still decide.
                      </p>
                      <div className="text-sm space-y-1">
                        <div>
                          Status:{' '}
                          <span className="font-mono text-xs">
                            {verification.rekognitionStatus ?? 'skipped'}
                          </span>
                        </div>
                        {similarity !== null && (
                          <div>
                            Similarity:{' '}
                            <span className={`font-semibold tabular-nums ${matchBadgeClass(similarity)} px-1.5 py-0.5 rounded border text-xs`}>
                              {similarity}%
                            </span>
                          </div>
                        )}
                        <div className="text-muted-foreground text-xs">
                          Selfie faces: {verification.selfieFaceCount ?? '—'} · ID faces:{' '}
                          {verification.idFrontFaceCount ?? '—'}
                        </div>
                        {(verification.rekognitionStatus === 'no_face_selfie' ||
                          verification.rekognitionStatus === 'no_face_id' ||
                          verification.rekognitionStatus === 'error') && (
                          <div className="text-amber-800 text-xs mt-1 leading-snug">
                            {verification.rekognitionStatus === 'error'
                              ? `Analyze error: ${verification.rekognitionError ?? 'unknown'}`
                              : verification.rekognitionStatus === 'no_face_selfie'
                                ? 'No face detected on selfie — lean reject unless clear photo.'
                                : 'No face detected on ID — lean reject unless clear crop.'}
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold">Your decision</Label>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={decision === 'approved' ? 'default' : 'outline'}
                          className={`h-16 flex flex-col items-center justify-center gap-1 ${
                            decision === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''
                          }`}
                          onClick={() => setDecision('approved')}
                        >
                          <CheckCircle className="w-5 h-5" />
                          <span className="text-xs sm:text-sm">Approve</span>
                        </Button>

                        <Button
                          type="button"
                          variant={decision === 'rejected' ? 'destructive' : 'outline'}
                          className="h-16 flex flex-col items-center justify-center gap-1"
                          onClick={() => setDecision('rejected')}
                        >
                          <XCircle className="w-5 h-5" />
                          <span className="text-xs sm:text-sm">Reject</span>
                        </Button>
                      </div>

                      {decision === 'rejected' && (
                        <div>
                          <Label htmlFor="reason" className="text-xs">
                            Rejection reason (optional, shown to user)
                          </Label>
                          <Textarea
                            id="reason"
                            placeholder="Blurry photo, face mismatch, expired ID…"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="mt-1"
                            rows={3}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>

                <DialogFooter className="p-4 border-t shrink-0 gap-2 sm:gap-2">
                  <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!decision || isSubmitting}
                    className={
                      decision === 'approved'
                        ? 'bg-green-600 hover:bg-green-700'
                        : decision === 'rejected'
                          ? ''
                          : ''
                    }
                    variant={decision === 'rejected' ? 'destructive' : 'default'}
                  >
                    {isSubmitting
                      ? 'Saving…'
                      : decision === 'approved'
                        ? 'Confirm approve'
                        : decision === 'rejected'
                          ? 'Confirm reject'
                          : 'Select a decision'}
                  </Button>
                </DialogFooter>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Simple lightbox */}
      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black border-slate-800">
          {lightbox && (
            <img src={lightbox} alt="Full size" className="w-full h-auto max-h-[85vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
