import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
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

  const currentStep = (STEPS[currentStepIndex] ?? STEPS[0]) as Readonly<{ key: StepKey; title: string; optional?: boolean }>;

  function setImageForStep(step: StepKey, image: PickedImage | null) {
    setImages(prev => ({ ...prev, [step]: image }));
  }

  async function pickForStep(step: StepKey) {
    // Bound the dimensions so the base64 payload stays well under the API's body
    // limit even with selfie + ID front + back in one submission.
    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1600,
      maxHeight: 1600,
      includeBase64: true,
    };

    const result = step === 'selfie'
      ? await launchCamera({ ...options, cameraType: 'front' } satisfies CameraOptions)
      : await launchImageLibrary(options);

    if (result.didCancel) return;

    const asset = result.assets?.[0];
    if (!asset?.uri || !asset.base64) {
      Alert.alert('Error', 'Could not access image');
      return;
    }

    setImageForStep(step, { uri: asset.uri, base64: asset.base64, type: asset.type ?? 'image/jpeg' });
  }

  async function uploadAll() {
    if (!images.selfie || !images.idFront) {
      Alert.alert('Missing Photos', 'Please provide at least a selfie and the front of your ID.');
      return;
    }

    setUploading(true);
    try {
      // Single base64 submission: the server decodes, uploads to S3 with the right
      // Content-Type, and generates the keys. This is the same transport the photo
      // gallery uses — React Native's binary PUT to a presigned URL is unreliable.
      await dispatch(submitIdVerification({
        selfie: images.selfie.base64,
        selfieContentType: images.selfie.type,
        idFront: images.idFront.base64,
        idFrontContentType: images.idFront.type,
        ...(images.idBack
          ? { idBack: images.idBack.base64, idBackContentType: images.idBack.type }
          : {}),
      })).unwrap();

      // Refresh the profile so the ProfileScreen card reflects "Under review"
      // (the submit flips id_verification_status to 'pending' server-side).
      void dispatch(fetchProfile());

      Alert.alert('Success', 'Verification submitted for review.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch {
      Alert.alert('Upload Failed', 'There was an error uploading your documents. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function next() {
    if (currentStep.key === 'selfie' && !images.selfie) {
      Alert.alert('Selfie required', 'Please take a selfie to continue.');
      return;
    }
    if (currentStep.key === 'idFront' && !images.idFront) {
      Alert.alert('ID required', 'Please upload the front of your ID.');
      return;
    }
    if (currentStepIndex < STEPS.length - 1) setCurrentStepIndex(i => i + 1);
  }

  function prev() {
    if (currentStepIndex > 0) setCurrentStepIndex(i => i - 1);
  }

  if (status === 'pending') {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.title}>Under review</Text>
        <Text style={styles.subtitle}>
          Your documents have been submitted. We'll update your profile once they're reviewed.
        </Text>
        <TouchableOpacity style={styles.primary} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.subtitle}>{currentStep.title}</Text>

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
          onPress={() => pickForStep(currentStep.key)}
          disabled={uploading}
        >
          <Text style={styles.buttonText}>
            {images[currentStep.key] ? 'Retake / Replace' : currentStep.key === 'selfie' ? 'Open Camera' : 'Choose Photo'}
          </Text>
        </TouchableOpacity>

        {images[currentStep.key] && !uploading && (
          <TouchableOpacity
            style={[styles.button, styles.ghost]}
            onPress={() => setImageForStep(currentStep.key, null)}
          >
            <Text style={[styles.buttonText, styles.ghostText]}>Remove</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.link} onPress={prev} disabled={currentStepIndex === 0 || uploading}>
          <Text style={[styles.linkText, (currentStepIndex === 0 || uploading) && styles.disabled]}>Back</Text>
        </TouchableOpacity>

        {currentStepIndex < STEPS.length - 1 ? (
          <TouchableOpacity style={styles.primary} onPress={next} disabled={uploading}>
            <Text style={styles.primaryText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.primary} onPress={uploadAll} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryText}>Submit for Verification</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  centered: { justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  subtitle: { color: '#444', marginBottom: 12 },
  previewArea: { height: 320, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f2f2f2', alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: '#888' },
  row: { flexDirection: 'row', marginTop: 12, gap: 8 },
  button: { flex: 1, padding: 12, backgroundColor: '#007aff', borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  ghost: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  ghostText: { color: '#333' },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, alignItems: 'center' },
  link: {},
  linkText: { color: '#007aff' },
  disabled: { color: '#bbb' },
  primary: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#007aff', borderRadius: 8, minWidth: 80, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '600' },
});
