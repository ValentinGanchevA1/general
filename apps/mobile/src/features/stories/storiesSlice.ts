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
      limit,
    });
    return res.stories;
  } catch (e) {
    return rejectWithValue(e instanceof Error ? e.message : 'Failed to load stories');
  }
});

export const fetchAuthorStories = createAsyncThunk<
  { authorId: string; stories: StoryCard[] },
  string
>('stories/byAuthor', async (authorId, { rejectWithValue }) => {
  try {
    const stories = await getJson<StoryCard[]>(`/stories/author/${authorId}`);
    return { authorId, stories };
  } catch (e) {
    return rejectWithValue(e instanceof Error ? e.message : 'Failed to load author stories');
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
    return rejectWithValue(e instanceof Error ? e.message : 'Presign failed');
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
    return rejectWithValue(e instanceof Error ? e.message : 'Create story failed');
  }
});

export const recordStoryView = createAsyncThunk<
  { storyId: string; viewCount: number },
  string
>('stories/view', async (storyId, { rejectWithValue }) => {
  try {
    const res = await postJson<Record<string, never>, RecordViewResponse>(
      `/stories/${storyId}/view`,
      {},
    );
    return { storyId, viewCount: res.viewCount };
  } catch (e) {
    return rejectWithValue(e instanceof Error ? e.message : 'View failed');
  }
});

export const reactToStory = createAsyncThunk<
  { storyId: string; reaction: StoryReactionKind; reactionCount: number },
  { storyId: string; kind: StoryReactionKind }
>('stories/react', async ({ storyId, kind }, { rejectWithValue }) => {
  try {
    const res = await postJson<{ kind: StoryReactionKind }, ReactStoryResponse>(
      `/stories/${storyId}/react`,
      { kind },
    );
    return { storyId, reaction: res.reaction, reactionCount: res.reactionCount };
  } catch (e) {
    return rejectWithValue(e instanceof Error ? e.message : 'React failed');
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
      const apply = (list: StoryCard[]) =>
        list.map((st) =>
          st.id === a.payload.storyId
            ? { ...st, viewedByMe: true, viewCount: a.payload.viewCount }
            : st,
        );
      s.nearby = apply(s.nearby);
      for (const key of Object.keys(s.byAuthor)) {
        s.byAuthor[key] = apply(s.byAuthor[key]!);
      }
    });

    b.addCase(reactToStory.fulfilled, (s, a) => {
      const apply = (list: StoryCard[]) =>
        list.map((st) =>
          st.id === a.payload.storyId
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
