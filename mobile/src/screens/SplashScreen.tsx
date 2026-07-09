import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

export function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>L</Text>
      </View>
      <Text style={styles.title}>LashlyAI</Text>
      <Text style={styles.tagline}>AI-powered lash artistry</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  badgeText: {
    fontSize: 40,
    fontWeight: '600',
    color: colors.background,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: 8,
    fontSize: 15,
    color: colors.accent,
    fontWeight: '500',
  },
});
