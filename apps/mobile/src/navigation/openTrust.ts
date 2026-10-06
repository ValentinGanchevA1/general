// Single entry for Trust hub + step routing.
// Prefer these helpers over direct openRootScreen('EmailVerification' | …) from product surfaces.

import type { VerificationLadderStep } from '@g88/shared';
import { openRootScreen, openViaRef } from './openRootScreen';

type NavLike = {
  navigate: (...args: never[]) => void;
};

/** Open the Trust status hub. Optional focusStep highlights a row. */
export function openTrustCenter(
  navigation: NavLike,
  focusStep?: VerificationLadderStep,
): void {
  if (focusStep != null) {
    openRootScreen(navigation, 'TrustCenter', { focusStep });
    return;
  }
  openRootScreen(navigation, 'TrustCenter');
}

/** Jump straight to the action screen for a ladder step. */
export function openTrustStep(
  navigation: NavLike,
  step: VerificationLadderStep,
  opts?: { initialPhone?: string },
): void {
  if (step === 'email') {
    openRootScreen(navigation, 'EmailVerification');
    return;
  }
  if (step === 'phone') {
    const phone = opts?.initialPhone;
    if (phone != null && phone !== '') {
      openRootScreen(navigation, 'Verification', { initialPhone: phone });
    } else {
      openRootScreen(navigation, 'Verification');
    }
    return;
  }
  openRootScreen(navigation, 'VerificationId');
}

export function openTrustCenterViaRef(focusStep?: VerificationLadderStep): void {
  if (focusStep != null) {
    openViaRef('TrustCenter', { focusStep });
    return;
  }
  openViaRef('TrustCenter');
}

export function openTrustStepViaRef(
  step: VerificationLadderStep,
  opts?: { initialPhone?: string },
): void {
  if (step === 'email') {
    openViaRef('EmailVerification');
    return;
  }
  if (step === 'phone') {
    const phone = opts?.initialPhone;
    if (phone != null && phone !== '') {
      openViaRef('Verification', { initialPhone: phone });
    } else {
      openViaRef('Verification');
    }
    return;
  }
  openViaRef('VerificationId');
}
