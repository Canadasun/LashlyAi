import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useVoiceDictation } from '../hooks/useVoiceDictation';
import { api } from '../services/api';
import { isQuotaExceededError, showQuotaExceededAlert } from '../services/quotaError';
import { colors } from '../theme/colors';
import { ClientNote } from '../types/api';

interface Props {
  clientId: string;
  onSaved: (note: ClientNote) => void;
  // Chairside Mode's dark theme needs light-on-dark styling; everywhere else (e.g.
  // ClientProfileView) uses the app's normal light-card look.
  dark?: boolean;
  // Only needed to route a quota-exceeded save to Paywall, same pattern as every other
  // Pro-gated action in the app (see services/quotaError.ts).
  navigation: { navigate: (screen: 'Paywall') => void };
}

/**
 * One-tap hands-free note dictation (Pro tier) — see docs/api-spec.md's
 * POST /clients/:id/notes. Built for a tech whose hands are busy with gloves/glue
 * mid-service: tap to start, tap again to stop, tap Save. No typing required.
 */
export function VoiceNoteRecorder({ clientId, onSaved, dark, navigation }: Props) {
  const { listening, transcript, error, start, stop, reset } = useVoiceDictation();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const toggle = () => {
    if (listening) {
      stop();
    } else {
      start();
    }
  };

  const save = async () => {
    if (!transcript.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const note = await api.post<ClientNote>(`/clients/${clientId}/notes`, {
        text: transcript.trim(),
        source: 'voice',
      });
      onSaved(note);
      reset();
    } catch (err) {
      if (isQuotaExceededError(err)) {
        showQuotaExceededAlert(err, navigation);
      } else {
        setSaveError(err instanceof Error ? err.message : 'Could not save note');
      }
    } finally {
      setSaving(false);
    }
  };

  const textColor = dark ? colors.background : colors.text;
  const mutedColor = dark ? colors.muted : colors.muted;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.micButton, listening && styles.micButtonActive]}
        onPress={toggle}>
        <Text style={styles.micButtonText}>{listening ? '⏹ Stop Dictation' : '🎤 Dictate Note'}</Text>
      </TouchableOpacity>

      {(listening || transcript.length > 0) && (
        <View style={[styles.transcriptCard, dark && styles.transcriptCardDark]}>
          <Text style={[styles.transcriptText, { color: textColor }]}>
            {transcript || (listening ? 'Listening…' : '')}
          </Text>
          {!listening && transcript.length > 0 && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.discardButton} onPress={reset} disabled={saving}>
                <Text style={[styles.discardButtonText, { color: mutedColor }]}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Note</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {(error || saveError) && (
        <Text style={[styles.errorText, dark && styles.errorTextDark]}>{error ?? saveError}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  micButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  micButtonActive: { backgroundColor: colors.danger },
  micButtonText: { color: colors.background, fontWeight: '700', fontSize: 14 },
  transcriptCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 10,
  },
  transcriptCardDark: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' },
  transcriptText: { fontSize: 14, lineHeight: 20 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  discardButton: { paddingVertical: 8, paddingHorizontal: 14 },
  discardButtonText: { fontSize: 13, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginLeft: 8,
  },
  saveButtonText: { color: colors.background, fontWeight: '700', fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 8 },
  errorTextDark: { color: '#FF8A8A' },
});
