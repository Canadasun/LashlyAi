import { useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../services/api';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';
import { LashMapZoneDiagram } from '../components/LashMapZoneDiagram';
import { DifficultyBadge } from '../components/DifficultyBadge';
import { VoiceNoteRecorder } from '../components/VoiceNoteRecorder';
import { ClientNote, DifficultyLabel } from '../types/api';

type Props = NativeStackScreenProps<RootStackParamList, 'ChairsideMode'>;

// Enlarges the zone diagram (fixed at 300x160 internally) for reading at arm's length
// off a propped-up iPad, without touching the shared component other screens use at
// its normal size.
const DIAGRAM_SCALE = 1.8;
const DIAGRAM_WIDTH = 300;
const DIAGRAM_HEIGHT = 160;

function BigStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

/**
 * iPad-only chairside reference mode (see LashMapScreen's tablet-only entry point):
 * a high-contrast, large-text, distraction-free full-screen readout of the current
 * lash map, meant to be glanced at from across the propped-up tablet's own stand
 * during application. The one interactive element is the voice-note recorder below —
 * a single tap to start/stop dictating, no typing — everything else stays read-only by
 * design. Deliberately no "keep screen awake" — that needs a new native dependency
 * (react-native-keep-awake) this pass didn't take on; if the screen auto-locks
 * mid-service, a tap wakes it back to the same content since nothing here is stateful
 * beyond the passed-in lashMap and the notes saved so far.
 */
export function ChairsideModeScreen({ route, navigation }: Props) {
  const { clientId, lashMap } = route.params;
  const insets = useSafeAreaInsets();
  const [clientName, setClientName] = useState('');
  const [savedNotes, setSavedNotes] = useState<ClientNote[]>([]);

  useEffect(() => {
    api
      .get<{ name: string }>(`/clients/${clientId}`)
      .then((result) => setClientName(result.name))
      .catch(() => {
        // Non-critical — the mode still works with just "Client" as a fallback label.
      });
  }, [clientId]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <TouchableOpacity style={styles.exitButton} onPress={() => navigation.goBack()}>
        <Text style={styles.exitButtonText}>✕ Exit Chairside Mode</Text>
      </TouchableOpacity>

      <Text style={styles.clientName}>{clientName || 'Client'}</Text>
      <Text style={styles.styleLabel}>{lashMap.style_label}</Text>

      {lashMap.difficulty_label && (
        <View style={styles.difficultyRow}>
          <DifficultyBadge label={lashMap.difficulty_label as DifficultyLabel} estimatedMinutes={lashMap.estimated_minutes} />
        </View>
      )}

      <View style={styles.diagramWrapper}>
        <View style={styles.diagramInner}>
          <LashMapZoneDiagram zones={lashMap.visual_map.zones} />
        </View>
      </View>

      <View style={styles.statsGrid}>
        <BigStat label="Curl" value={lashMap.curl_label} />
        <BigStat label="Diameter" value={lashMap.diameter} />
        <BigStat label="Fan Type" value={lashMap.fan_type} />
        {lashMap.lash_set_label && <BigStat label="Lash Set" value={lashMap.lash_set_label} />}
        {lashMap.lash_style_label && <BigStat label="Lash Style" value={lashMap.lash_style_label} />}
      </View>

      {lashMap.textured_map && (
        <View style={styles.texturedRow}>
          <View style={styles.texturedPane}>
            <Text style={styles.texturedLabel}>Base Layer</Text>
            <View style={styles.texturedCard}>
              <LashMapZoneDiagram zones={lashMap.textured_map.base_layer.zones} />
            </View>
          </View>
          <View style={styles.texturedPane}>
            <Text style={styles.texturedLabel}>Spike Layer</Text>
            <View style={styles.texturedCard}>
              <LashMapZoneDiagram zones={lashMap.textured_map.spike_layer.zones} />
            </View>
          </View>
        </View>
      )}

      <View style={styles.notesSection}>
        <Text style={styles.notesTitle}>Quick Note</Text>
        <VoiceNoteRecorder
          clientId={clientId}
          dark
          onSaved={(note) => setSavedNotes((prev) => [note, ...prev])}
        />
        {savedNotes.map((note) => (
          <Text key={note.id} style={styles.savedNoteText}>
            ✓ {note.text}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Deliberately its own dark, high-contrast look — distinct from the rest of the
  // app's soft-nude theme, since this mode is read from arm's length, not held close.
  container: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 32, alignItems: 'center' },
  exitButton: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.background,
    marginBottom: 20,
  },
  exitButtonText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  clientName: { color: colors.background, fontSize: 34, fontWeight: '800', textAlign: 'center' },
  styleLabel: { color: colors.accent, fontSize: 22, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  difficultyRow: { marginTop: 16 },
  diagramWrapper: {
    // The shared LashMapZoneDiagram draws dark text/lines meant for a light
    // background (same as every other screen that uses it) — this white card behind
    // it is what keeps it legible against this screen's dark theme, not a cosmetic
    // choice.
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: DIAGRAM_WIDTH * DIAGRAM_SCALE + 48,
    height: DIAGRAM_HEIGHT * DIAGRAM_SCALE + 48,
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagramInner: {
    width: DIAGRAM_WIDTH,
    height: DIAGRAM_HEIGHT,
    transform: [{ scale: DIAGRAM_SCALE }],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 24,
    width: '100%',
  },
  stat: {
    minWidth: 200,
    alignItems: 'center',
    margin: 16,
  },
  statLabel: { color: colors.muted, fontSize: 15, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  statValue: { color: colors.background, fontSize: 30, fontWeight: '800', marginTop: 6, textAlign: 'center' },
  texturedRow: { flexDirection: 'row', marginTop: 32, width: '100%', justifyContent: 'center' },
  texturedPane: { alignItems: 'center', marginHorizontal: 24 },
  texturedLabel: { color: colors.accent, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  texturedCard: { backgroundColor: colors.surface, borderRadius: 14, padding: 10 },
  notesSection: { width: '100%', maxWidth: 480, marginTop: 36 },
  notesTitle: {
    color: colors.background,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  savedNoteText: { color: colors.background, fontSize: 13, marginTop: 10, opacity: 0.85 },
});
