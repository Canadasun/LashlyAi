import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { launchCamera, launchImageLibrary, Asset } from 'react-native-image-picker';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { ScanningProgress } from '../components/ScanningProgress';
import { AiConsentCheckbox } from '../components/AiConsentCheckbox';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { EyeAnalysis } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'CameraUpload'>;

interface QuotaField {
  used: number;
  limit: number | null;
}

export function CameraUploadScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaField | null>(null);
  const [consented, setConsented] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api
        .get<{ eye_scans_this_month: QuotaField }>('/users/me/usage')
        .then((usage) => setQuota(usage.eye_scans_this_month))
        .catch(() => {
          // Non-critical — quota display just won't show.
        });
    }, []),
  );

  const pick = async (fromCamera: boolean) => {
    setError(null);
    const result = fromCamera
      ? await launchCamera({ mediaType: 'photo', quality: 0.8 })
      : await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });

    if (result.didCancel) return;
    if (result.errorMessage) {
      setError(result.errorMessage);
      return;
    }
    const asset = result.assets?.[0];
    if (asset) setPhoto(asset);
  };

  const analyze = async () => {
    if (!photo?.uri || !consented) return;
    setAnalyzing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('photo', {
        uri: photo.uri,
        name: photo.fileName ?? 'eye.jpg',
        type: photo.type ?? 'image/jpeg',
      } as unknown as Blob);
      form.append('consented', 'true');

      const result = await api.postForm<{ photo_url: string; eye_analysis: EyeAnalysis }>(
        `/clients/${clientId}/eye-analysis`,
        form,
      );

      navigation.replace('EyeAnalysisResult', {
        clientId,
        eyeAnalysis: result.eye_analysis,
        photoUrl: result.photo_url,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Photograph the client's eye</Text>
      {quota && quota.limit !== null && (
        <Text style={styles.quotaText}>
          {quota.used}/{quota.limit} eye scans used this month
        </Text>
      )}

      {analyzing ? (
        <ScanningProgress />
      ) : photo?.uri ? (
        <Image source={{ uri: photo.uri }} style={styles.preview} />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>No photo yet</Text>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity style={styles.secondaryButton} onPress={() => pick(true)}>
        <Text style={styles.secondaryButtonText}>Take Photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondaryButton} onPress={() => pick(false)}>
        <Text style={styles.secondaryButtonText}>Choose from Library</Text>
      </TouchableOpacity>

      {photo?.uri && (
        <AiConsentCheckbox
          checked={consented}
          onToggle={() => setConsented((v) => !v)}
          purpose="analyze the eye shape and lash characteristics"
        />
      )}

      <TouchableOpacity
        style={[styles.primaryButton, (!photo || !consented) && styles.disabledButton]}
        onPress={analyze}
        disabled={!photo || !consented || analyzing}>
        {analyzing ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.primaryButtonText}>Analyze Eye</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
  quotaText: { fontSize: 11, color: colors.accent, fontWeight: '600', marginBottom: 12 },
  preview: { width: '100%', height: 260, borderRadius: 12, marginBottom: 16 },
  placeholder: {
    width: '100%',
    height: 260,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  placeholderText: { color: colors.accent },
  error: { color: '#B3261E', marginBottom: 12, fontSize: 13 },
  secondaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '600' },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledButton: { opacity: 0.5 },
  primaryButtonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
