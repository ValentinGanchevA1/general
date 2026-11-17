import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminPersonalLabelProposal, AdminPersonalLabelProposalPage,
  PersonalLabel, PersonalLabelCatalogResponse, PersonalLabelCategory,
  PersonalLabelProposalStatus, PersonalLabelReviewRequest,
} from '@g88/shared';
import { PERSONAL_LABEL_CATEGORIES } from '@g88/shared';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const PAGE_SIZE = 20;
const KEY = ['admin', 'personal-labels'] as const;

async function loadQueue(status: PersonalLabelProposalStatus, offset: number): Promise<AdminPersonalLabelProposalPage> {
  const { data } = await apiClient.get<AdminPersonalLabelProposalPage>('/admin/personal-label-proposals', {
    params: { status, offset, limit: PAGE_SIZE },
  });
  return data;
}
async function loadCatalog(): Promise<PersonalLabel[]> {
  const { data } = await apiClient.get<PersonalLabelCatalogResponse>('/personal-labels/catalog?locale=en');
  return data.items;
}

function Suggestion({
  item, catalog, onDecide, busy,
}: {
  item: AdminPersonalLabelProposal;
  catalog: PersonalLabel[];
  onDecide: (id: string, request: PersonalLabelReviewRequest) => void;
  busy: boolean;
}) {
  const [key, setKey] = useState('');
  const [bg, setBg] = useState(item.locale === 'bg' ? item.text : '');
  const [en, setEn] = useState(item.locale === 'en' ? item.text : '');
  const [category, setCategory] = useState<PersonalLabelCategory>('character');
  const [emoji, setEmoji] = useState('');
  const [existingKey, setExistingKey] = useState('');
  const [note, setNote] = useState('');
  const pending = item.status === 'pending';

  const approve = (): void => {
    if (!window.confirm('Publish this label in both languages for all users?')) return;
    onDecide(item.id, {
      decision: 'approve', key: key.trim(), labelBg: bg.trim(), labelEn: en.trim(),
      category, ...(emoji.trim() ? { emoji: emoji.trim() } : {}),
    });
  };
  const merge = (): void => {
    if (!existingKey || !window.confirm('Merge this proposal with the selected existing label?')) return;
    onDecide(item.id, { decision: 'merge', existingKey, note });
  };
  const reject = (): void => {
    if (!window.confirm('Reject this suggestion?')) return;
    onDecide(item.id, { decision: 'reject', note });
  };

  return (
    <article className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <strong className="break-words">{item.text}</strong>
        <span className="bg-muted rounded px-2">{item.locale.toUpperCase()}</span>
        <span className="bg-muted rounded px-2">{item.status}</span>
        <span className="text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
      </div>
      {pending ? (
        <>
          <p className="text-sm text-muted-foreground">
            Human review required. Reject harassment, sexual claims, protected traits, duplicates and interests.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm space-y-1">Stable key
              <input value={key} onChange={e => setKey(e.target.value.toLowerCase())}
                placeholder="e.g. deep_thinker" maxLength={31}
                className="w-full rounded border bg-background p-2" />
            </label>
            <label className="text-sm space-y-1">Category
              <select value={category} onChange={e => setCategory(e.target.value as PersonalLabelCategory)}
                className="w-full rounded border bg-background p-2">
                {PERSONAL_LABEL_CATEGORIES.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-sm space-y-1">Bulgarian label
              <input value={bg} onChange={e => setBg(e.target.value)} maxLength={40}
                className="w-full rounded border bg-background p-2" />
            </label>
            <label className="text-sm space-y-1">English label
              <input value={en} onChange={e => setEn(e.target.value)} maxLength={40}
                className="w-full rounded border bg-background p-2" />
            </label>
            <label className="text-sm space-y-1">Emoji (optional)
              <input value={emoji} onChange={e => setEmoji(e.target.value)} maxLength={8}
                className="w-full rounded border bg-background p-2" />
            </label>
            <label className="text-sm space-y-1">Merge with approved label
              <select value={existingKey} onChange={e => setExistingKey(e.target.value)}
                className="w-full rounded border bg-background p-2">
                <option value="">Choose approved label</option>
                {catalog.map(label => <option key={label.key} value={label.key}>{label.label} ({label.key})</option>)}
              </select>
            </label>
          </div>
          <label className="block text-sm space-y-1">Moderation note (internal)
            <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300}
              className="w-full rounded border bg-background p-2" rows={2} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || !key.trim() || bg.trim().length < 3 || en.trim().length < 3}
              onClick={approve}>Approve & publish</Button>
            <Button variant="outline" disabled={busy || !existingKey} onClick={merge}>Merge duplicate</Button>
            <Button variant="destructive" disabled={busy} onClick={reject}>Reject</Button>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Reviewed: {item.reviewedAt ?? 'unknown'} · note: {item.reviewNote ?? '—'}
        </p>
      )}
    </article>
  );
}

export default function PersonalLabelsPage() {
  const [status, setStatus] = useState<PersonalLabelProposalStatus>('pending');
  const [offset, setOffset] = useState(0);
  const client = useQueryClient();
  const queue = useQuery({
    queryKey: [...KEY, status, offset],
    queryFn: () => loadQueue(status, offset),
  });
  const catalog = useQuery({ queryKey: [...KEY, 'catalog'], queryFn: loadCatalog });
  const decide = useMutation({
    mutationFn: async ({ id, request }: { id: string; request: PersonalLabelReviewRequest }) => {
      await apiClient.post(`/admin/personal-label-proposals/${id}/decide`, request);
    },
    onSuccess: async () => {
      toast.success('Suggestion reviewed');
      await client.invalidateQueries({ queryKey: [...KEY] });
    },
    onError: () => toast.error('Review failed. Verify translations, unique labels and permissions.'),
  });

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-wrap gap-3 items-center justify-between border-b pb-4">
          <div>
            <h1 className="text-2xl font-bold">Personal label proposals</h1>
            <p className="text-sm text-muted-foreground">Manual bilingual moderation. Never auto-publish user text.</p>
          </div>
          <div className="flex gap-2 items-center">
            <label htmlFor="personal-label-status">Status</label>
            <select id="personal-label-status" value={status} onChange={event => {
              setStatus(event.currentTarget.value as PersonalLabelProposalStatus);
              setOffset(0);
            }} className="rounded border bg-background p-2">
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="merged">Merged</option>
            </select>
            <Button variant="outline" onClick={() => void queue.refetch()} disabled={queue.isFetching}>Refresh</Button>
          </div>
        </div>
        {queue.isLoading ? <p role="status">Loading suggestions…</p> : null}
        {queue.error || catalog.error ? <p role="alert" className="text-destructive">Unable to fetch moderation data.</p> : null}
        {queue.data?.items.length === 0 ? <p>No suggestions on this page.</p> : null}
        {queue.data?.items.map(item => (
          <Suggestion key={item.id} item={item} catalog={catalog.data ?? []}
            busy={decide.isPending}
            onDecide={(id, request) => decide.mutate({ id, request })} />
        ))}
        <div className="flex justify-between gap-3 items-center">
          <Button variant="outline" disabled={offset === 0 || queue.isFetching}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
          <span className="text-sm">Page {Math.floor(offset / PAGE_SIZE) + 1}</span>
          <Button variant="outline" disabled={queue.data?.nextOffset == null || queue.isFetching}
            onClick={() => setOffset(queue.data?.nextOffset ?? offset)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
