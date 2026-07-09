import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LashMapZoneDiagram } from '../components/LashMapZoneDiagram';
import { colors } from '../theme/colors';
import { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LashMap'>;

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function LashMapScreen({ route, navigation }: Props) {
  const { clientId, lashMap } = route.params;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Lash Map</Text>
      <Text style={styles.savedNote}>Saved to this client's history</Text>

      <View style={styles.diagramCard}>
        <LashMapZoneDiagram zones={lashMap.visual_map.zones} />
      </View>

      <View style={styles.statsRow}>
        <Stat label="Style" value={lashMap.style} />
        <Stat label="Curl" value={lashMap.curl} />
        <Stat label="Diameter" value={lashMap.diameter} />
      </View>
      <View style={styles.statsRow}>
        <Stat label="Fan Type" value={lashMap.fan_type} />
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ClientProfile', { clientId })}>
        <Text style={styles.buttonText}>Back to Client</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, alignSelf: 'flex-start' },
  savedNote: {
    fontSize: 12,
    color: colors.accent,
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  diagramCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  statsRow: { flexDirection: 'row', width: '100%', marginBottom: 12 },
  stat: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textTransform: 'capitalize',
  },
  statLabel: { fontSize: 11, color: colors.accent, marginTop: 4 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  buttonText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
