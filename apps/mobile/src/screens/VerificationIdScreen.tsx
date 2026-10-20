import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  launchCamera,
  launchImageLibrary,
  type CameraOptions,
  type ImageLibraryOptions,
} from 'react-native-image-picker';

import { ScreenHeader } from '@/components/ScreenHeader';
import { fetchProfile } from '@/features/profile/profileSlice';
import {
  fetchIdVerificationStatus,
  submitIdVerification,
} from '@/features/verification/idVerificationSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import type { AccountStackParamList } from '@/navigation/stacks';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';
import { appAlert } from '@/ui/appAlert';
import { extractMessage } from '@/utils/extractMessage';

type StepKey = 'selfie' | 'idFront' | 'idBack';
type PickedImage = { uri: string; base64: string; type: string };

interface VerificationStep {
  key: StepKey;
  title: string;
  eyebrow: string;
  description: string;
  optional?: boolean;
}

const STEPS: VerificationStep[] = [
  {
    key: 'selfie',
    title: 'Take a selfie',
    eyebrow: 'LIVE IDENTITY',
    description: 'Use a clear, current photo of your face.',
  },
  {
    key: 'idFront',
    title: 'Government ID — front',
    eyebrow: 'DOCUMENT CHECK',
    description: 'Use a clear photo with all document edges visible.',
  },
  {
    key: 'idBack',
    title: 'Government ID — back',
    eyebrow: 'OPTIONAL DOCUMENT',
    description: 'Add the reverse side when it contains useful verification details.',
    optional: true,
  },
];

export default function VerificationIdScreen(): React.ReactElement {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.idVerification.status);

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

  const currentStep = STEPS[currentStepIndex] ?? STEPS[0]!;

  const setImageForStep = (step: StepKey, image: PickedImage | null): void => {
    setImages((previous) => ({ ...previous, [step]: image }));
  };

  const pickForStep = async (step: StepKey): Promise<void> => {
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
      appAlert('Photo unavailable', 'Could not access the selected image.');
      return;
    }

    setImageForStep(step, {
      uri: asset.uri,
      base64: asset.base64,
      type: asset.type ?? 'image/jpeg',
    });
  };

  const uploadAll = async (): Promise<void> => {
    if (!images.selfie || !images.idFront) {
      appAlert('Photos required', 'Provide a selfie and the front of your government ID.');
      return;
    }

    setUploading(true);
    try {
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

      void dispatch(fetchProfile());
      appAlert('Submitted', 'Your identity verification is now under review.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (error: unknown) {
      const message = extractMessage(
        error,
        'There was an error uploading your documents. Please try again.',
      );
      Sentry.captureException(error, { tags: { resource: 'verification.id_submit' } });
      if (__DEV__) console.warn('[id-verify] submit failed', error);
      appAlert('Upload failed', message);
    } finally {
      setUploading(false);
    }
  };

  const next = (): void => {
    if (currentStep.key === 'selfie' && !images.selfie) {
      appAlert('Selfie required', 'Take a selfie to continue.');
      return;
    }
    if (currentStep.key === 'idFront' && !images.idFront) {
      appAlert('ID required', 'Add the front of your government ID.');
      return;
    }
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex((index) => index + 1);
    }
  };

  const previous = (): void => {
    if (currentStepIndex > 0) setCurrentStepIndex((index) => index - 1);
  };

  if (status === 'verified') {
    return (
      <View style={[styles.root, { backgroundColor: colors.canvas }]}>
        <ScreenHeader title="Identity verification" bordered onBack={() => navigation.goBack()} />
        <View style={[styles.body, styles.centered]}>
          <View
            style={[
              styles.stateIcon,
              { backgroundColor: colors.discoverySoft, borderColor: colors.discoveryBorder },
            ]}
          >
            <Icon name="shield-check" size={38} color={colors.verified} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Identity verified</Text>
          <Text style={[styles.stateDetail, { color: colors.textSecondary }]}> 
            Your government ID verification is complete. Public surfaces show the verification state, not your submitted document images.
          </Text>
          <TouchableOpacity
            style={[styles.primary, { backgroundColor: colors.actionPrimary }]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (status === 'pending') {
    return (
      <View style={[styles.root, { backgroundColor: colors.canvas }]}>
        <ScreenHeader title="Identity verification" bordered onBack={() => navigation.goBack()} />
        <View style={[styles.body, styles.centered]}>
          <View
            style={[
              styles.stateIcon,
              { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderDefault },
            ]}
          >
            <Icon name="clock-outline" size={38} color={colors.warning} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Under review</Text>
          <Text style={[styles.stateDetail, { color: colors.textSecondary }]}> 
            Your submission is being reviewed. You cannot submit another verification while this review is pending.
          </Text>
          <TouchableOpacity
            style={[styles.primary, { backgroundColor: colors.actionPrimary }]}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScreenHeader
        title="Identity verification"
        bordered
        onBack={() => navigation.goBack()}
        right={
          <Text style={[styles.stepBadge, { color: colors.textTertiary }]}>
            {currentStepIndex + 1}/{STEPS.length}
          </Text>
        }
      />

      <View style={styles.body}>
        <View style={styles.progressRow} accessibilityRole="progressbar">
          {STEPS.map((step, index) => (
            <View
              key={step.key}
              style={[
                styles.progressSegment,
                {
                  backgroundColor:
                    index <= currentStepIndex ? colors.discovery : colors.surfaceTertiary,
                },
              ]}
            />
          ))}
        </View>

        {status === 'rejected' ? (
          <View
            style={[
              styles.notice,
              { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder },
            ]}
          >
            <Icon name="alert-circle-outline" size={20} color={colors.danger} />
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}> 
              The previous submission needs attention. Review each photo and submit a clearer set.
            </Text>
          </View>
        ) : (
          <View
            style={[
              styles.notice,
              { backgroundColor: colors.discoverySoft, borderColor: colors.discoveryBorderSoft },
            ]}
          >
            <Icon name="shield-lock-outline" size={20} color={colors.discovery} />
            <Text style={[styles.noticeText, { color: colors.textSecondary }]}> 
              These images are submitted for identity review. Your public profile exposes verification status, not the document images.
            </Text>
          </View>
        )}

        <Text style={[styles.eyebrow, { color: colors.discovery }]}>{currentStep.eyebrow}</Text>
        <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{currentStep.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}> 
          {currentStep.description}
        </Text>
        {currentStep.optional ? (
          <Text style={[styles.optionalHint, { color: colors.textTertiary }]}>Optional — you can skip this step</Text>
        ) : null}

        <View
          style={[
            styles.previewArea,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: images[currentStep.key] ? colors.discoveryBorder : colors.borderDefault,
            },
          ]}
        >
          {images[currentStep.key] ? (
            <Image source={{ uri: images[currentStep.key]!.uri }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Icon
                name={currentStep.key === 'selfie' ? 'face-recognition' : 'card-account-details-outline'}
                size={42}
                color={colors.textTertiary}
              />
              <Text style={[styles.placeholderText, { color: colors.textTertiary }]}>No photo selected</Text>
            </View>
          )}
        </View>

        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.captureButton, { backgroundColor: colors.actionPrimary }]}
            onPress={() => void pickForStep(currentStep.key)}
            disabled={uploading}
            accessibilityRole="button"
          >
            <Icon
              name={currentStep.key === 'selfie' ? 'camera-outline' : 'image-outline'}
              size={18}
              color={colors.onPrimary}
            />
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}> 
              {images[currentStep.key]
                ? 'Replace photo'
                : currentStep.key === 'selfie'
                  ? 'Open camera'
                  : 'Choose photo'}
            </Text>
          </TouchableOpacity>

          {images[currentStep.key] && !uploading ? (
            <TouchableOpacity
              style={[styles.removeButton, { borderColor: colors.borderStrong }]}
              onPress={() => setImageForStep(currentStep.key, null)}
              accessibilityRole="button"
              accessibilityLabel="Remove selected photo"
            >
              <Text style={[styles.removeText, { color: colors.textPrimary }]}>Remove</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={previous}
            disabled={currentStepIndex === 0 || uploading}
            accessibilityRole="button"
            accessibilityLabel="Previous verification step"
          >
            <Text
              style={[
                styles.backText,
                {
                  color:
                    currentStepIndex === 0 || uploading
                      ? colors.textDisabled
                      : colors.textSecondary,
                },
              ]}
            >
              Back
            </Text>
          </TouchableOpacity>

          {currentStepIndex < STEPS.length - 1 ? (
            <TouchableOpacity
              style={[styles.primary, { backgroundColor: colors.actionPrimary }]}
              onPress={next}
              disabled={uploading}
              accessibilityRole="button"
            >
              <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.primary, styles.submitButton, { backgroundColor: colors.actionPrimary }]}
              onPress={() => void uploadAll()}
              disabled={uploading}
              accessibilityRole="button"
              accessibilityLabel="Submit identity verification"
            >
              {uploading ? (
                <ActivityIndicator color={colors.onPrimary} size="small" />
              ) : (
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Submit for review</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, padding: spacing.lg },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  stateIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateDetail: {
    maxWidth: 360,
    fontSize: fontSize.sm,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  stepBadge: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: spacing.lg,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  noticeText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  optionalHint: {
    fontSize: fontSize.xs,
    marginBottom: spacing.sm,
  },
  previewArea: {
    flex: 1,
    minHeight: 220,
    maxHeight: 340,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  placeholderText: { fontSize: fontSize.sm },
  row: {
    flexDirection: 'row',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  captureButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  buttonText: { fontWeight: '700', fontSize: fontSize.sm },
  removeButton: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontWeight: '600', fontSize: fontSize.sm },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  backButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  backText: { fontWeight: '600' },
  primary: {
    minHeight: 48,
    minWidth: 96,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: { minWidth: 160 },
  primaryText: { fontWeight: '700', fontSize: fontSize.sm },
});
