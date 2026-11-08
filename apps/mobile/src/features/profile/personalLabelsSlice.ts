import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type {
  PersonalLabel, PersonalLabelCatalogResponse, PersonalLabelsFeaturePolicy,
  PersonalLabelProposal, PersonalLabelProposalPage,
  ProposePersonalLabelRequest, SelectedPersonalLabelsResponse, SetPersonalLabelsRequest,
} from '@g88/shared';
import { getJson, postJson, putJson } from '@/api/client';
import { Config } from '@/config';
import { extractMessage } from '@/utils/extractMessage';
import { logout } from '@/features/auth/authSlice';

interface PersonalLabelsState {
  enabled: boolean;
  loading: boolean;
  saving: boolean;
  proposing: boolean;
  catalog: PersonalLabel[];
  selected: PersonalLabel[];
  proposals: PersonalLabelProposal[];
  error: string | null;
  notice: string | null;
}
const initialState: PersonalLabelsState = {
  enabled: false, loading: false, saving: false, proposing: false,
  catalog: [], selected: [], proposals: [], error: null, notice: null,
};

/** The mobile build must explicitly request the feature before any network request. */
export const loadPersonalLabels = createAsyncThunk(
  'personalLabels/load',
  async (_, { rejectWithValue }) => {
    if (!Config.PERSONAL_LABELS_REQUESTED) {
      return { enabled: false as const };
    }
    try {
      const policy = await getJson<PersonalLabelsFeaturePolicy>('/runtime-config/personal-labels');
      if (!policy.enabled) return { enabled: false as const };
      const [catalog, mine, proposals] = await Promise.all([
        getJson<PersonalLabelCatalogResponse>('/personal-labels/catalog?locale=en'),
        getJson<SelectedPersonalLabelsResponse>('/personal-labels/me?locale=en'),
        getJson<PersonalLabelProposalPage>('/personal-labels/proposals/me'),
      ]);
      return {
        enabled: true as const,
        catalog: catalog.items,
        selected: mine.items,
        proposals: proposals.items,
      };
    } catch (error) {
      return rejectWithValue(extractMessage(error, 'Could not load personality labels.'));
    }
  },
);

export const savePersonalLabels = createAsyncThunk(
  'personalLabels/save',
  async (keys: string[], { rejectWithValue }) => {
    try {
      const response = await putJson<SetPersonalLabelsRequest, SelectedPersonalLabelsResponse>(
        '/personal-labels/me?locale=en', { keys },
      );
      return response.items;
    } catch (error) {
      return rejectWithValue(extractMessage(error, 'Could not save labels.'));
    }
  },
);

export const suggestPersonalLabel = createAsyncThunk(
  'personalLabels/suggest',
  async (req: ProposePersonalLabelRequest, { rejectWithValue }) => {
    try {
      return await postJson<ProposePersonalLabelRequest, PersonalLabelProposal>(
        '/personal-labels/proposals', req,
      );
    } catch (error) {
      return rejectWithValue(extractMessage(error, 'Could not submit suggestion.'));
    }
  },
);

const slice = createSlice({
  name: 'personalLabels',
  initialState,
  reducers: {
    clearPersonalLabelsFeedback: (state) => { state.error = null; state.notice = null; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadPersonalLabels.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loadPersonalLabels.fulfilled, (state, action) => {
        state.loading = false;
        state.enabled = action.payload.enabled;
        if (action.payload.enabled) {
          state.catalog = action.payload.catalog;
          state.selected = action.payload.selected;
          state.proposals = action.payload.proposals;
        } else {
          state.catalog = [];
          state.selected = [];
          state.proposals = [];
        }
      })
      .addCase(loadPersonalLabels.rejected, (state, action) => {
        state.loading = false;
        state.enabled = false; // fail closed; do not reveal stale data
        state.catalog = [];
        state.selected = [];
        state.proposals = [];
        state.error = action.payload as string;
      })
      .addCase(savePersonalLabels.pending, (state) => { state.saving = true; state.error = null; state.notice = null; })
      .addCase(savePersonalLabels.fulfilled, (state, action) => {
        state.saving = false;
        state.selected = action.payload;
        state.notice = 'Personal labels saved.';
      })
      .addCase(savePersonalLabels.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string;
      })
      .addCase(suggestPersonalLabel.pending, (state) => { state.proposing = true; state.error = null; state.notice = null; })
      .addCase(suggestPersonalLabel.fulfilled, (state, action) => {
        state.proposing = false;
        state.proposals.unshift(action.payload);
        state.notice = 'Suggestion sent for review. It is not public yet.';
      })
      .addCase(suggestPersonalLabel.rejected, (state, action) => {
        state.proposing = false;
        state.error = action.payload as string;
      })
      .addCase(logout.fulfilled, () => initialState)
      .addCase(logout.rejected, () => initialState);
  },
});

export const { clearPersonalLabelsFeedback } = slice.actions;
export default slice.reducer;
