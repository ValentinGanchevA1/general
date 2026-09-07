import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import { useNavigation } from '@react-navigation/native';
import {
  launchImageLibrary,
  launchCamera,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {
  submitIdVerification,
  fetchIdVerificationStatus,
} from '@/features/verification/idVerificationSlice';
import { fetchProfile } from '@/features/profile/profileSlice';
import { extractMessage } from '@/utils/extractMessage';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing, radius } from '@/theme';

type StepKey = 'selfie' | 'idFront' | 'idBack';

/** A picked image: `uri` for preview, `base64` + `type` for the upload payload. */
type PickedImage = { uri: string; base64: string; type: string };

const STEPS: { key: StepKey; title: string; optional?: boolean }[] = [
  { key: 'selfie', title: 'Take a selfie' },
  { key: 'idFront', title: 'Upload ID — front' },
  { key: 'idBack', title: 'Upload ID — back', optional: true },
];

export default function VerificationIdScreen(): React.ReactElement {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.idVerification.status);

  // Pull the latest status on entry so a returning user sees "under review"
  // instead of being able to re-submit a pending request.
  useEffect(() => {
    void dispatch(fetchIdVerificationStatus());
  }, [dispatch]);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [images, setImages] = useState<Record<StepKey, PickedImage | null>>({
    selfie: null,
    idFront: null,
    idBack: null,
  });
  const [uploading, setUploading] = useState(false);

  const currentStep = (STEPS[currentStepIndex] ?? STEPS[0]) as Readonly<{
    key: StepKey;
    title: string;
    optional?: boolean;
  }>;

  function setImageForStep(step: StepKey, image: PickedImage | null) {
    setImages((prev) => ({ ...prev, [step]: image }));
  }

  async function pickForStep(step: StepKey) {
    // Bound the dimensions so the base64 payload stays well under the API's body
    // limit even with selfie + ID front + back in one submission.
    // PhotoQuality is a discrete union (0 | 0.1 | … | 1) — 0.65 is not assignable.
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.6,
      maxWidth: 1280,
      maxHeight: 1280,
      includeBase64: true,
    };

    const result =
      step === 'selfie'
        ? await launchCamera({ ...options, cameraType: 'front' } satisfies CameraOptions)
        : await launchImageLibrary(options);

    if (result.didCancel) return;

    const asset = result.assets?.[0];
    if (!asset?.uri || !asset.base64) {
      appAlert('Error', 'Could not access image');
      return;
    }

    setImageForStep(step, {
      uri: asset.uri,
      base64: asset.base64,
      type: asset.type ?? 'image/jpeg',
    });
  }

  async function uploadAll() {
    if (!images.selfie || !images.idFront) {
      appAlert('Missing Photos', 'Please provide at least a selfie and the front of your ID.');
      return;
    }

    setUploading(true);
    try {
      // Single base64 submission: the server decodes, uploads to S3 with the right
      // Content-Type, and generates the keys. This is the same transport the photo
      // gallery uses — React Native's binary PUT to a presigned URL is unreliable.
      await dispatch(
        submitIdVerification({
          selfie: images.selfie.base64,
          selfieContentType: images.selfie.type,
          idFront: images.idFront.base64,
          idFrontContentType: images.idFront.type,
          ...(images.idBack
            ? { idBack: images.idBack.base64, idBackContentType: images.idBack.type }
            : {}),
        }),
      ).unwrap();

      // Refresh the profile so the ProfileScreen card reflects "Under review"
      // (the submit flips id_verification_status to 'pending' server-side).
      void dispatch(fetchProfile());

      appAlert('Success', 'Verification submitted for review.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg = extractMessage(
        e,
        'There was an error uploading your documents. Please try again.',
      );
      // eslint-disable-next-line no-console -- debug path for emulator submit failures
      console.warn('[id-verify] submit failed', e);
      appAlert('Upload Failed', msg);
    } finally {
      setUploading(false);
    }
  }

  function next() {
    if (currentStep.key === 'selfie' && !images.selfie) {
      appAlert('Selfie required', 'Please take a selfie to continue.');
      return;
    }
    if (currentStep.key === 'idFront' && !images.idFront) {
      appAlert('ID required', 'Please upload the front of your ID.');
      return;
    }
    if (currentStepIndex < STEPS.length - 1) setCurrentStepIndex((i) => i + 1);
  }

  function prev() {
    if (currentStepIndex > 0) setCurrentStepIndex((i) => i - 1);
  }

  if (status === 'pending') {
    return (
      <View style={styles.root}>
        <ScreenHeader title="ID verification" bordered onBack={() => navigation.goBack()} />
        <View style={[styles.body, styles.centered]}>
          <Text style={styles.title}>Under review</Text>
          <Text style={styles.subtitle}>
            Your documents have been submitted. We'll update your profile once they're
            reviewed.
          </Text>
          <TouchableOpacity style={styles.primary} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="ID verification"
        bordered
        onBack={() => navigation.goBack()}
        right={
          <Text style={styles.stepBadge}>
            {currentStepIndex + 1}/{STEPS.length}
          </Text>
        }
      />
      <View style={styles.body}>
        <Text style={styles.subtitle}>{currentStep.title}</Text>
        {currentStep.optional ? (
          <Text style={styles.optionalHint}>Optional — you can skip this step</Text>
        ) : null}

        <View style={styles.previewArea}>
          {images[currentStep.key] ? (
            <Image source={{ uri: images[currentStep.key]!.uri }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderText}>No photo selected</Text>
            </View>
          )}
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              void pickForStep(currentStep.key);
            }}
            disabled={uploading}
          >
            <Text style={styles.buttonText}>
              {images[currentStep.key]
                ? 'Retake / Replace'
                : currentStep.key === 'selfie'
                  ? 'Open Camera'
                  : 'Choose Photo'}
            </Text>
          </TouchableOpacity>

          {images[currentStep.key] && !uploading ? (
            <TouchableOpacity
              style={[styles.button, styles.ghost]}
              onPress={() => setImageForStep(currentStep.key, null)}
            >
              <Text style={[styles.buttonText, styles.ghostText]}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.link}
            onPress={prev}
            disabled={currentStepIndex === 0 || uploading}
          >
            <Text
              style={[
                styles.linkText,
                (currentStepIndex === 0 || uploading) && styles.disabled,
              ]}
            >
              Back
            </Text>
          </TouchableOpacity>

          {currentStepIndex < STEPS.length - 1 ? (
            <TouchableOpacity style={styles.primary} onPress={next} disabled={uploading}>
              <Text style={styles.primaryText}>
                {currentStep.optional && !images[currentStep.key] ? 'Skip' : 'Next'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.primary} onPress={() => { void uploadAll(); }} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={styles.primaryText}>Submit for verification</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, padding: spacing.lg },
  centered: { justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  stepBadge: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    marginBottom: spacing.sm,
  },
  optionalHint: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  previewArea: {
    height: 320,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.textMuted },
  row: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
  button: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  buttonText: { color: colors.onPrimary, fontWeight: '700' },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghostText: { color: colors.textPrimary },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  link: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
  linkText: { color: colors.primary, fontWeight: '600' },
  disabled: { color: colors.textFaint },
  primary: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    minWidth: 80,
    alignItems: 'center',
  },
  primaryText: { color: colors.onPrimary, fontWeight: '700' },
});
