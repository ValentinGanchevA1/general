import React, { useState } from 'react';
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
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useAppDispatch } from '@/hooks/redux';
import { submitIdVerification } from '@/features/verification/idVerificationSlice';
import { api } from '@/api/client';

type StepKey = 'selfie' | 'idFront' | 'idBack';

const STEPS: { key: StepKey; title: string; optional?: boolean }[] = [
  { key: 'selfie', title: 'Take a selfie' },
  { key: 'idFront', title: 'Upload ID — front' },
  { key: 'idBack', title: 'Upload ID — back', optional: true },
];

export default function VerificationIdScreen(): React.ReactElement {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [images, setImages] = useState<Record<StepKey, string | null>>({
    selfie: null,
    idFront: null,
    idBack: null,
  });
  const [uploading, setUploading] = useState(false);

  const currentStep = (STEPS[currentStepIndex] ?? STEPS[0]) as Readonly<{ key: StepKey; title: string; optional?: boolean }>;

  function setImageForStep(step: StepKey, uri: string | null) {
    setImages(prev => ({ ...prev, [step]: uri }));
  }

  async function pickForStep(step: StepKey) {
    const options = {
      mediaType: 'photo' as const,
      quality: 0.9,
      includeBase64: false,
    };

    // Cast to any: react-native-image-picker's PhotoQuality type is incompatible with standard quality values.
    // This is a known library typing issue; runtime behavior is correct.
    const result = step === 'selfie'
      ? await launchCamera({ ...options, cameraType: 'front' } as any)
      : await launchImageLibrary(options as any);

    if (result.didCancel) return;
    
    const uri = result.assets?.[0]?.uri;
    if (!uri) {
      Alert.alert('Error', 'Could not access image');
      return;
    }

    setImageForStep(step, uri);
  }

  async function uploadAll() {
    if (!images.selfie || !images.idFront) {
      Alert.alert('Missing Photos', 'Please provide at least a selfie and the front of your ID.');
      return;
    }

    setUploading(true);
    try {
      // 1. Get presigned URLs from backend
      const { data: presigned } = await api.post('/verification/id/start');
      
      // Helper to upload to S3 via PUT
      const uploadToS3 = async (uri: string, uploadUrl: string) => {
        const response = await fetch(uri);
        const blob = await response.blob();
        await fetch(uploadUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': blob.type },
        });
      };

      // 2. Perform uploads
      await uploadToS3(images.selfie, presigned.selfieUploadUrl);
      await uploadToS3(images.idFront, presigned.idFrontUploadUrl);
      
      // 3. Submit keys to mark as pending
      // We extract the S3 key from the presigned URL
      const selfieKey = presigned.selfieUploadUrl.split('?')[0].split('.com/')[1];
      const idFrontKey = presigned.idFrontUploadUrl.split('?')[0].split('.com/')[1];

      await dispatch(submitIdVerification({
        selfieKey,
        idFrontKey,
        // idBackKey remains optional and is currently not provided by startVerification API
      })).unwrap();

      Alert.alert('Success', 'Verification submitted for review.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      Alert.alert('Upload Failed', 'There was an error uploading your documents. Please try again.');
      console.error(err);
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify your identity</Text>
      <Text style={styles.subtitle}>{currentStep.title}</Text>

      <View style={styles.previewArea}>
        {images[currentStep.key] ? (
          <Image source={{ uri: images[currentStep.key] as string }} style={styles.preview} />
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
