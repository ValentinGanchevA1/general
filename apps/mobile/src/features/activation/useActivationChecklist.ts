import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppSelector } from '@/hooks/redux';
import { track } from '@/lib/analytics';

import {
	ACTIVATION_POSTED_KEY,
	ACTIVATION_STORAGE_KEY,
	ACTIVATION_WAVED_KEY,
	selectActivationSteps,
	type ActivationChecklistResult,
	type ActivationStep,
} from './activationChecklist';

export async function markActivationWaved(): Promise<void> {
	try {
		await AsyncStorage.setItem(ACTIVATION_WAVED_KEY, '1');
	} catch {
		// ignore
	}
}

export async function markActivationPosted(): Promise<void> {
	try {
		await AsyncStorage.setItem(ACTIVATION_POSTED_KEY, '1');
	} catch {
		// ignore
	}
}

interface UseActivationChecklistResult {
	visible: boolean;
	steps: ActivationStep[];
	incompleteCount: number;
	dismiss: () => void;
	/** Re-read local waved/posted flags (call after mark*). */
	refreshLocal: () => void;
}

/**
 * First-session checklist. Persists dismiss/done; waved/posted are client marks.
 */
export function useActivationChecklist(opts: {
	hasLocation: boolean;
}): UseActivationChecklistResult {
	const { hasLocation } = opts;
	const emailVerified =
		useAppSelector((s) => s.profile.profile?.badges?.email === true) === true;

	const [storageState, setStorageState] = useState<'dismissed' | 'done' | null>(
		null,
	);
	const [hasWaved, setHasWaved] = useState(false);
	const [hasPosted, setHasPosted] = useState(false);
	const [hydrated, setHydrated] = useState(false);

	const load = useCallback(() => {
		void (async () => {
			try {
				const [state, waved, posted] = await Promise.all([
					AsyncStorage.getItem(ACTIVATION_STORAGE_KEY),
					AsyncStorage.getItem(ACTIVATION_WAVED_KEY),
					AsyncStorage.getItem(ACTIVATION_POSTED_KEY),
				]);
				const nextState =
					state === 'dismissed' || state === 'done' ? state : null;
				// Defer setState out of the effect tick (lint).
				setTimeout(() => {
					setStorageState(nextState);
					setHasWaved(waved === '1');
					setHasPosted(posted === '1');
					setHydrated(true);
				}, 0);
			} catch {
				setTimeout(() => setHydrated(true), 0);
			}
		})();
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const selected: ActivationChecklistResult = useMemo(
		() =>
			selectActivationSteps({
				emailVerified,
				hasLocation,
				hasWaved,
				hasPosted,
				storageState,
			}),
		[emailVerified, hasLocation, hasWaved, hasPosted, storageState],
	);

	// Persist 