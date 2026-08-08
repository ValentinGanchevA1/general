import { createAsyncThunk, createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type {
  CreateStoryResponse,
  NearbyStoriesResponse,
  ReactStoryResponse,
  RecordViewResponse,
  StoryCard,
  StoryNewEvent,
  StoryPresignResponse,
  StoryReactionKind,
  Viewport,
} from '@g88/shared';

import { getJson, postJson } from '@/api/client';

function errorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'string' && e.trim()) return e;
  if (e && typeof e === 'object') {
    const o = e as { message?: unknown; code?: unknown; payload?: unknown };
    if (typeof o.message === 'string' && o.message.trim()) return o.message;
    if (typeof o.payload === 'string' && o.payload.trim()) return o.payload;
    if (typeof o.code === 'string' && o.code.trim()) return o.code;
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export interface StoriesState {
  nearby: StoryCard[];
  byAuthor: Record<string, StoryCard[]>;
  loading: boolean;
  posting: boolean;
  error: string | null;
  lastViewportKey: string | null;
}

const initialState: StoriesState = {
  nearby: [],
  byAuthor: {},
  loading: false,
  posting: false,
  error: null,
  lastViewportKey: null,
};

function viewportKey(v: Viewport, zoom: number): string {
  return `${v.sw.lat.toFixed(4)},${v.sw.lng.toFixed(4)}|${v.ne.lat.toFixed(4)},${v.ne.lng.toFixed(4)}|${zoom}`;
}

export const fetchNearbyStories = createAsyncThunk<
  StoryCard[],
  { viewport: Viewport; zoom: number; limit?: number }
>('stories/nearby', async ({ viewport, zoom, limit }, { rejectWithValue }) => {
  try {
    const res = await postJson<
      { ne: Viewport['ne']; sw: Viewport['sw']; zoom: number; limit?: number },
      NearbyStoriesResponse
    >('/stories/nearby', {
      ne: viewport.ne,
      sw: viewport.sw,
      zoom,
      ...(limit !== undefined ? { limit } : {}),
    });
    return res.stories;
  } catch (e) {
    return rejectWithValue(errorMessage(e, 'Failed to load stories'));
  }
});

export const fetchAuthorStories = createAsyncThunk<
  { authorId: string; stories: StoryCard[] },
  { authorId: string; includeExpired?: boolean; limit?: number } | string
>('stories/byAuthor', async (arg, { rejectWithValue }) => {
  const authorId = typeof arg === 'string' ? arg : arg.authorId;
  const includeExpired = typeof arg === 'string' ? false : Boolean(arg.includeExpired);
  const limit = typeof arg === 'string' ? 50 : (arg.limit ?? 50);
  try {
    const qs = new URLSearchParams();
    if (includeExpired) qs.set('includeExpired', '1');
    qs.set('limit', String(limit));
    const q = qs.toString();
    const stories = await getJson<StoryCard[]>(
      `/stories/author/${authorId}${q ? `?${q}` : ''}`,
    );
    return { authorId, stories };
  } catch (e) {
    return rejectWithValue(errorMessage(e, 'Failed to load author stories'));
  }
});

export const presignStory = createAsyncThunk<
  StoryPresignResponse,
  { contentType: string }
>('stories/presign', async ({ contentType }, { rejectWithValue }) => {
  try {
    return await postJson<{ contentType: string }, StoryPresignResponse>('/stories/presign', {
      contentType,
    });
  } catch (e) {
    return rejectWithValue(errorMessage(e, 'Presign failed'));
  }
});

export const createStory = createAsyncThunk<
  StoryCard,
  {
    mediaUrl: string;
    mediaType: 'image' | 'video';
    caption?: string;
    location: { lat: number; lng: number };
  }
>('stories/create', async (body, { rejectWithValue }) => {
  try {
    const res = await postJson<typeof body, CreateStoryResponse>('/stories', body);
    return res.story;
  } catch (e) {
    return rejectWithValue(errorMessage(e, 'Failed to create story'));
  }
});

export const recordStoryView = createAsyncThunk<
  RecordViewResponse,
  string
>('stories/view', async (storyId, { rejectWithValue }) => {
  try {
    return await postJson<Record<string, never>, RecordViewResponse>(
      `/stories/${storyId}/view`,
      {},
    );
  } catch (e) {
    return rejectWithValue(errorMessage(e, 'Failed to record view'));
  }
});

export const reactToStory = createAsyncThunk<
  ReactStoryResponse,
  { storyId: string; kind: StoryReactionKind }
>('stories/react', async ({ storyId, kind }, { rejectWithValue }) => {
  try {
    return await postJson<{ kind: StoryReactionKind }, ReactStoryResponse>(
      `/stories/${storyId}/react`,
      { kind },
    );
  } catch (e) {
    return rejectWithValue(errorMessage(e, 'Failed to react'));
  }
});

const slice = createSlice({
  name: 'stories',
  initialState,
  reducers: {
    storyReceived: (s, a: PayloadAction<StoryNewEvent>) => {
      const card = a.payload.story;
      if (!s.nearby.some((x) => x.id === card.id)) {
        s.nearby = [card, ...s.nearby].slice(0, 50);
      }
      const list = s.byAuthor[card.authorId] ?? [];
      if (!list.some((x) => x.id === card.id)) {
        s.byAuthor[card.authorId] = [...list, card];
      }
    },
    clearStories: (s) => {
      s.nearby = [];
      s.error = null;
      s.lastViewportKey = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchNearbyStories.pending, (s) => {
      s.loading = true;
      s.error = null;
    });
    b.addCase(fetchNearbyStories.fulfilled, (s, a) => {
      s.loading = false;
      s.nearby = a.payload;
      s.lastViewportKey = viewportKey(a.meta.arg.viewport, a.meta.arg.zoom);
    });
    b.addCase(fetchNearbyStories.rejected, (s, a) => {
      s.loading = false;
      s.error = (a.payload as string) ?? 'Failed';
    });

    b.addCase(fetchAuthorStories.fulfilled, (s, a) => {
      s.byAuthor[a.payload.authorId] = a.payload.stories;
    });

    b.addCase(createStory.pending, (s) => {
      s.posting = true;
      s.error = null;
    });
    b.addCase(createStory.fulfilled, (s, a) => {
      s.posting = false;
      s.nearby = [a.payload, ...s.nearby];
      const list = s.byAuthor[a.payload.authorId] ?? [];
      s.byAuthor[a.payload.authorId] = [...list, a.payload];
    });
    b.addCase(createStory.rejected, (s, a) => {
      s.posting = false;
      s.error = (a.payload as string) ?? 'Create failed';
    });

    b.addCase(recordStoryView.fulfilled, (s, a) => {
      const storyId = a.meta.arg;
      const apply = (list: StoryCard[]) =>
        list.map((st) =>
          st.id === storyId
            ? { ...st, viewedByMe: true, viewCount: a.payload.viewCount }
            : st,
        );
      s.nearby = apply(s.nearby);
      for (const key of Object.keys(s.byAuthor)) {
        s.byAuthor[key] = apply(s.byAuthor[key]!);
      }
    });

    b.addCase(reactToStory.fulfilled, (s, a) => {
      const storyId = a.meta.arg.storyId;
      const apply = (list: StoryCard[]) =>
        list.map((st) =>
          st.id === storyId
            ? {
                ...st,
                myReaction: a.payload.reaction,
                reactionCount: a.payload.reactionCount,
              }
            : st,
        );
      s.nearby = apply(s.nearby);
      for (const key of Object.keys(s.byAuthor)) {
        s.byAuthor[key] = apply(s.byAuthor[key]!);
      }
    });
  },
});

export const { storyReceived, clearStories } = slice.actions;
export default slice.reducer;
