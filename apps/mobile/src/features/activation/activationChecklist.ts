// Pure activation checklist selector (first-session map jobs).
// Client-only flags for wave/post; email + location from live state.

export type ActivationStepId = 'email' | 'location' | 'wave' | 'post';

export type ActivationStepAction =
	| 'verify_email'
	| 'enable_location'
	| 'wave'
	| 'create';

export interface ActivationStep {
	id: ActivationStepId;
	label: string;
	done: boolean;
	action: ActivationStepAction;
}

export interface ActivationChecklistInputs {
	emailVerified: boolean;
	hasLocation: boolean;
	hasWaved: boolean;
	hasPosted: boolean;
	/** AsyncStorage: dismissed | done | null */
	storageState: 'dismissed' | 'done' | null;
}

export interface ActivationChecklistResult {
	/** Show card when incomplete steps remain and not dismissed/done. */
	visible: boolean;
	steps: ActivationStep[];
	incompleteCount: number;
	allDone: boolean;
}

const STEP_META: Record<
	ActivationStepId,
	{ label: string; action: ActivationStepAction }
> = {
	email: { label: 'Verify email', action: 'verify_email' },
	location: { label: 'Share location', action: 'enable_location' },
	wave: { label: 'Wave to someone nearby', action: 'wave' },
	post: { label: 'Post something nearby', action: 'create' },
};

const ORDER: ActivationStepId[] = ['email', 'location', 'wave', 'post'];

/**
 * Build checklist steps. At most 3 incomplete steps returned for UI density.
 */
export function selectActivationSteps(
	input: ActivationChecklistInputs,
): ActivationChecklistResult {
	if (input.storageState === 'dismissed' || input.storageState === 'done') {
		return { visible: false, steps: [], incompleteCount: 0, allDone: true };
	}

	const doneMap: Record<ActivationStepId, boolean> = {
		email: input.emailVerified,
		location: input.hasLocation,
		wave: input.hasWaved,
		post: input.hasPosted,
	};

	const steps: ActivationStep[] = ORDER.map((id) => ({
		id,
		label: STEP_META[id].label,
		done: doneMap[id],
		action: STEP_META[id].action,
	}));

	const incomplete = steps.filter((s) => !s.done);
	const allDone = incomplete.length === 0;

	// UI: show incomplete first, then done (max 3 rows).
	const ordered = [
		...incomplete,
		...steps.filter((s) => s.done),
	].slice(0, 3);

	return {
		visible: !allDone,
		steps: ordered,
		incompleteCount: incomplete.length,
		allDone,
	};
}

export const ACTIVATION_STORAGE_KEY = 'g88:activation_checklist_v1';
export const ACTIVATION_WAVED_KEY = 'g88:activation_waved_v1';
export const ACTIVATION_POSTED_KEY = 'g88:activation_posted_v1';
