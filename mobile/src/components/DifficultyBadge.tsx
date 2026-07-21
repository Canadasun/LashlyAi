import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { DifficultyLabel } from '../types/api';

const LABEL_COLOR: Record<DifficultyLabel, string> = {
  Quick: colors.success,
  Standard: colors.accent,
  Technical: colors.primary,
  'Expert-Level': colors.danger,
};

interface Props {
  label: DifficultyLabel;
  estimatedMinutes?: { min: number; max: number };
  compact?: boolean;
}

export function DifficultyBadge({ label, estimatedMinutes, compact }: Props) {
  const tint = LABEL_COLOR[label];
  return (
    <View style={[styles.badge, { borderColor: tint, backgroundColor: `${tint}1A` }]}>
      <Text style={[styles.label, { color: tint }]}>{label}</Text>
      {!compact && estimatedMinutes && (
        <Text style={styles.minutes}>
          ~{estimatedMinutes.min}–{estimatedMinutes.max} min
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  label: { fontSize: 11, fontWeight: '700' },
  minutes: { fontSize: 11, color: colors.muted, marginLeft: 6 },
});
