import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme/colors';
import {
  DENSITY_GUIDE,
  EYE_SHAPE_GUIDE,
  GLUE_GUIDE,
  LASH_SET_GUIDE,
  LASH_STYLE_GUIDE,
} from '../data/lashReferenceData';
import { ResponsiveContainer } from '../components/ResponsiveContainer';

type Section = 'eyeShapes' | 'lashSets' | 'lashStyles' | 'diameters' | 'glue';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'lashSets', label: 'Lash Sets' },
  { key: 'eyeShapes', label: 'Eye Shapes' },
  { key: 'lashStyles', label: 'Lash Styles' },
  { key: 'diameters', label: 'Diameter' },
  { key: 'glue', label: 'Glue & Humidity' },
];

function EstimateTag({ confirmed }: { confirmed: boolean }) {
  return (
    <Text style={[styles.tag, confirmed ? styles.tagConfirmed : styles.tagEstimate]}>
      {confirmed ? 'Confirmed' : 'Estimate'}
    </Text>
  );
}

export function ReferenceGuideScreen() {
  const [section, setSection] = useState<Section>('lashSets');

  return (
    <View style={styles.screen}>
      <View style={styles.chipBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {SECTIONS.map((s) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.chip, section === s.key && styles.chipActive]}
              onPress={() => setSection(s.key)}>
              <Text style={[styles.chipText, section === s.key && styles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <ResponsiveContainer maxWidth={700}>
        <Text style={styles.disclaimer}>
          Quick reference only, not a substitute for your own training. Rows tagged
          "Estimate" haven't been confirmed against real lash-industry standards yet.
        </Text>

        {section === 'lashSets' && (
          <>
            <Text style={styles.sectionTitle}>Lash Sets</Text>
            {LASH_SET_GUIDE.map((set) => (
              <View key={set.name} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{set.name}</Text>
                  <Text style={[styles.tierBadge, set.tier === 'Pro' && styles.tierBadgePro]}>{set.tier}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Diameter</Text>
                  <View style={styles.rowValueWrap}>
                    <Text style={styles.rowValue}>{set.diameter}</Text>
                    <EstimateTag confirmed={set.diameterConfirmed} />
                  </View>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Curl</Text>
                  <Text style={styles.rowValue}>{set.curl}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Lengths (mm)</Text>
                  <Text style={styles.rowValue}>{set.lengths}</Text>
                </View>
                <Text style={styles.cardNote}>{set.note}</Text>
              </View>
            ))}
          </>
        )}

        {section === 'eyeShapes' && (
          <>
            <Text style={styles.sectionTitle}>Eye Shape → Style & Curl</Text>
            {EYE_SHAPE_GUIDE.map((row) => (
              <View key={row.eyeShape} style={styles.card}>
                <Text style={styles.cardTitle}>{row.eyeShape}</Text>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Style</Text>
                  <Text style={styles.rowValue}>{row.style}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Curl</Text>
                  <Text style={styles.rowValue}>{row.curl}</Text>
                </View>
                <Text style={styles.cardNote}>{row.note}</Text>
              </View>
            ))}
          </>
        )}

        {section === 'lashStyles' && (
          <>
            <Text style={styles.sectionTitle}>Lash Styles</Text>
            {LASH_STYLE_GUIDE.map((style) => (
              <View key={style.name} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{style.name}</Text>
                  <EstimateTag confirmed={style.confirmed} />
                </View>
                <Text style={styles.cardBody}>{style.mapping}</Text>
                <Text style={styles.cardNote}>Best for: {style.bestFor}</Text>
              </View>
            ))}
          </>
        )}

        {section === 'diameters' && (
          <>
            <Text style={styles.sectionTitle}>Diameter by Natural Density</Text>
            <Text style={styles.sectionSubtitle}>
              Used when a Lash Set doesn't have its own confirmed diameter yet.
            </Text>
            {DENSITY_GUIDE.map((row) => (
              <View key={row.density} style={styles.card}>
                <Text style={styles.cardTitle}>{row.density}</Text>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Diameter</Text>
                  <Text style={styles.rowValue}>{row.diameter}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Fan type</Text>
                  <Text style={styles.rowValue}>{row.fanType}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {section === 'glue' && (
          <>
            <Text style={styles.sectionTitle}>Glue & Humidity</Text>
            {GLUE_GUIDE.map((row) => (
              <View key={row.humidity} style={styles.card}>
                <Text style={styles.cardTitle}>{row.humidity}</Text>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Viscosity</Text>
                  <Text style={styles.rowValue}>{row.viscosity}</Text>
                </View>
                <View style={styles.rowLine}>
                  <Text style={styles.rowLabel}>Cure time</Text>
                  <Text style={styles.rowValue}>{row.cureTime}</Text>
                </View>
                <Text style={styles.cardNote}>{row.note}</Text>
              </View>
            ))}
          </>
        )}
        </ResponsiveContainer>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  chipBar: { borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background },
  chipRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  content: { padding: 16, paddingBottom: 36 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16, marginBottom: 16 },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  sectionSubtitle: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  cardBody: { color: colors.text, fontSize: 12, lineHeight: 17, marginTop: 8 },
  cardNote: { color: colors.muted, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  rowLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  rowValueWrap: { alignItems: 'flex-end' },
  rowValue: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1, marginLeft: 12 },
  tierBadge: {
    color: colors.success,
    backgroundColor: '#E1EFE8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  tierBadgePro: { color: colors.accent, backgroundColor: colors.accentSoft },
  tag: { fontSize: 9, fontWeight: '700', marginTop: 3 },
  tagConfirmed: { color: colors.success },
  tagEstimate: { color: colors.accent },
});
