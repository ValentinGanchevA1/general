import {
	selectActivationSteps,
	type ActivationChecklistInputs,
} from './activationChecklist';

function base(over: Partial<ActivationChecklistInputs> = {}): ActivationChecklistInputs {
	return {
		emailVerified: false,
		hasLocation: false,
		hasWaved: false,
		hasPosted: false,
		storageState: null,
		...over,
	};
}

describe('selectActivationSteps', () => {
	it('shows all incomplete when fresh', () => {
		const r = selectActivationSteps(base());
		expect(r.visible).toBe(true);
		expect(r.incompleteCount).toBe(4);
		expect(r.steps).toHaveLength(3); // UI cap
		expect(r.steps.every((s) => !s.done)).toBe(true);
		expect(r.steps[0]?.id).toBe('email');
	});

	it('hides when dismissed', () => {
		const r = selectActivationSteps(base({ storageState: 'dismissed' }));
		expect(r.visible).toBe(false);
		expect(r.steps).toEqual([]);
	});

	it('hides when storage done', () => {
		const r = selectActivationSteps(base({ storageState: 'done' }));
		expect(r.visible).toBe(false);
	});

	it('marks email + location done', () => {
		const r = selectActivationSteps(
			base({ emailVerified: true, hasLocation: true }),
		);
		expect(r.incompleteCount).toBe(2);
		expect(r.steps.find((s) => s.id === 'email')?.done).toBe(true);
		expect(r.steps.find((s) => s.id === 'location')?.done).toBe(true);
		expect(r.steps.find((s) => s.id === 'wave')?.done).toBe(false);
	});

	it('allDone when every step complete', () => {
		const r = selectActivationSteps(
			base({
				emailVerified: true,
				hasLocation: true,
				hasWaved: true,
				hasPosted: true,
			}),
		);
		expect(r.allDone).toBe(true);
		expect(r.visible).toBe(false);
		expect(r.incompleteCount).toBe(0);
	});

	it('orders incomplete before done', () => {
		const r = selectActivationSteps(
			base({ emailVerified: true, hasLocation: false, hasWaved: false }),
		);
		expect(r.steps[0]?.done).toBe(false);
		const email = r.steps.find((s) => s.id === 'email');
		expect(email?.done).toBe(true);
	});
});
